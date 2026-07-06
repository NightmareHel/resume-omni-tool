// Ingest H-1B sponsorship data into the sponsor_history table.
//
// Usage:
//   npx tsx scripts/ingest-sponsors.ts uscis            # FY2021-2023 Data Hub CSVs (backfill)
//   npx tsx scripts/ingest-sponsors.ts dol 2026 2       # DOL LCA disclosure FY2026 Q2 (primary)
//
// DOL files are FY-cumulative, so each ingest replaces that FY's rows.
// dol.gov (Akamai) 403s non-browser clients from some networks; if the
// download fails, download the file in a browser and drop it into
// data/sponsor/, then re-run the same command.

import fs from 'fs';
import path from 'path';
import { getDb } from '../lib/db';
import { sponsor_history } from '../lib/schema';
import { and, eq } from 'drizzle-orm';
import { normalizeEmployer } from '../lib/sponsorship';
import ExcelJS from 'exceljs';

const DATA_DIR = path.join(process.cwd(), 'data', 'sponsor');
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

interface Agg {
  employerRaw: string;
  totalLcas: number;
  newEmployment: number;
  techLcas: number;
  wages: number[];
}

function aggFor(map: Map<string, Agg>, raw: string): Agg | null {
  const norm = normalizeEmployer(raw);
  if (!norm) return null;
  let a = map.get(norm);
  if (!a) {
    a = { employerRaw: raw, totalLcas: 0, newEmployment: 0, techLcas: 0, wages: [] };
    map.set(norm, a);
  }
  return a;
}

async function download(url: string, dest: string): Promise<boolean> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA } });
    if (!res.ok) {
      console.error(`  download failed: ${res.status} ${url}`);
      return false;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    console.log(`  downloaded ${(buf.length / 1024 / 1024).toFixed(1)} MB -> ${dest}`);
    return true;
  } catch (err) {
    console.error(`  download error: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

async function saveAggregates(map: Map<string, Agg>, fy: number, source: 'dol' | 'uscis') {
  const db = getDb();
  await db
    .delete(sponsor_history)
    .where(and(eq(sponsor_history.fy, fy), eq(sponsor_history.source, source)));

  const rows = [...map.entries()].map(([norm, a]) => {
    a.wages.sort((x, y) => x - y);
    const median = a.wages.length ? Math.round(a.wages[Math.floor(a.wages.length / 2)]) : null;
    return {
      employer_norm: norm,
      employer_raw: a.employerRaw,
      fy,
      total_lcas: a.totalLcas,
      new_employment: a.newEmployment,
      tech_lcas: a.techLcas,
      median_wage: median,
      source,
    };
  });

  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(sponsor_history).values(rows.slice(i, i + 500));
  }
  console.log(`  saved ${rows.length} employers for FY${fy} (${source})`);
}

// --------------------------------------------------------------------------
// USCIS Data Hub CSVs (FY2009-2023 available; we take 2021-2023)
// Header: "Fiscal Year",Employer,"Initial Approval","Initial Denial",
//         "Continuing Approval","Continuing Denial",NAICS,"Tax ID",State,City,ZIP
// --------------------------------------------------------------------------

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

async function ingestUscis() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const fy of [2021, 2022, 2023]) {
    console.log(`USCIS FY${fy}:`);
    const file = path.join(DATA_DIR, `h1b_datahubexport-${fy}.csv`);
    if (!fs.existsSync(file)) {
      const ok = await download(
        `https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-${fy}.csv`,
        file
      );
      if (!ok) {
        console.error(`  skipping FY${fy}; download the CSV manually into ${DATA_DIR}`);
        continue;
      }
    }
    const lines = fs.readFileSync(file, 'utf-8').split(/\r?\n/);
    const map = new Map<string, Agg>();
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const cols = parseCsvLine(line);
      if (cols.length < 6) continue;
      const employer = cols[1]?.trim();
      if (!employer) continue;
      const initApproval = parseInt(cols[2], 10) || 0;
      const contApproval = parseInt(cols[4], 10) || 0;
      const a = aggFor(map, employer);
      if (!a) continue;
      a.totalLcas += initApproval + contApproval; // approvals, not LCAs, but same signal role
      a.newEmployment += initApproval;
      // no SOC data in the hub export; tech_lcas stays 0 for uscis rows
    }
    await saveAggregates(map, fy, 'uscis');
  }
}

// --------------------------------------------------------------------------
// DOL LCA disclosure XLSX (quarterly, FY-cumulative, ~100k+ rows)
// --------------------------------------------------------------------------

async function ingestDol(fy: number, quarter: number) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const fname = `LCA_Disclosure_Data_FY${fy}_Q${quarter}.xlsx`;
  const file = path.join(DATA_DIR, fname);
  if (!fs.existsSync(file)) {
    console.log(`DOL FY${fy} Q${quarter}: downloading (large file, may take a while)...`);
    const ok = await download(`https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/${fname}`, file);
    if (!ok) {
      console.error(
        `dol.gov blocked the download. Open the URL in a browser, save the file to ${DATA_DIR}, and re-run.`
      );
      process.exit(1);
    }
  }

  console.log(`DOL FY${fy} Q${quarter}: parsing ${fname} (streaming)...`);
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(file, {
    sharedStrings: 'cache',
    hyperlinks: 'ignore',
    styles: 'ignore',
    worksheets: 'emit',
  });

  const map = new Map<string, Agg>();
  let header: Record<string, number> | null = null;
  let rowCount = 0;
  let kept = 0;

  for await (const sheet of reader) {
    for await (const row of sheet) {
      const values = row.values as (string | number | null | undefined)[]; // 1-based
      if (!header) {
        header = {};
        values.forEach((v, i) => {
          if (typeof v === 'string') header![v.trim().toUpperCase()] = i;
        });
        const required = ['EMPLOYER_NAME', 'CASE_STATUS', 'VISA_CLASS'];
        const missing = required.filter((c) => header![c] === undefined);
        if (missing.length) {
          console.error(`Missing expected columns: ${missing.join(', ')}. Header row: ${values.join(' | ')}`);
          process.exit(1);
        }
        continue;
      }
      rowCount++;
      const get = (col: string) => {
        const i = header![col];
        return i === undefined ? undefined : values[i];
      };
      const status = String(get('CASE_STATUS') ?? '');
      const visa = String(get('VISA_CLASS') ?? '');
      if (!/certified/i.test(status) || !/h-?1b\b/i.test(visa)) continue;
      const employer = String(get('EMPLOYER_NAME') ?? '').trim();
      if (!employer) continue;

      const a = aggFor(map, employer);
      if (!a) continue;
      kept++;
      a.totalLcas += 1;
      a.newEmployment += parseInt(String(get('NEW_EMPLOYMENT') ?? '0'), 10) || 0;
      const soc = String(get('SOC_CODE') ?? '');
      if (soc.startsWith('15-')) a.techLcas += 1;
      const wage = parseFloat(String(get('WAGE_RATE_OF_PAY_FROM') ?? ''));
      const unit = String(get('WAGE_UNIT_OF_PAY') ?? 'Year');
      if (!isNaN(wage) && /year/i.test(unit)) a.wages.push(wage);

      if (rowCount % 50000 === 0) console.log(`  ...${rowCount} rows scanned, ${kept} kept`);
    }
    break; // data is on the first worksheet
  }

  console.log(`  ${rowCount} rows scanned, ${kept} certified H-1B rows kept, ${map.size} employers`);
  await saveAggregates(map, fy, 'dol');
}

// --------------------------------------------------------------------------

async function main() {
  const [mode, fyArg, qArg] = process.argv.slice(2);
  if (mode === 'uscis') {
    await ingestUscis();
  } else if (mode === 'dol') {
    const fy = parseInt(fyArg, 10);
    const q = parseInt(qArg ?? '4', 10);
    if (!fy) {
      console.error('Usage: npx tsx scripts/ingest-sponsors.ts dol <FY> [quarter]');
      process.exit(1);
    }
    await ingestDol(fy, q);
  } else {
    console.error('Usage: npx tsx scripts/ingest-sponsors.ts <uscis | dol FY [quarter]>');
    process.exit(1);
  }
  console.log('Done.');
}

main();
