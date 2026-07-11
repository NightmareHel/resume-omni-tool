# Mac Mini Deployment Checklist

Cutover target: **before August 24, 2026** (SAP start — laptop availability drops to near zero after this date).

The Mac Mini already runs 24/7 (MM-Server/Hermes). JobPilot's workers move there so scraping, scoring, and email sync continue without the laptop.

## Steps

1. **SSH in and clone**
   ```bash
   git clone https://github.com/NightmareHel/jobpilot.git && cd jobpilot
   ```

2. **`.env.local`** (copy values from the laptop's `.env.local`):
   ```
   GROQ_API_KEY=gsk_...
   GMAIL_CLIENT_ID=...
   GMAIL_CLIENT_SECRET=...
   GMAIL_REFRESH_TOKEN=...    # from scripts/gmail-auth.ts — token is portable
   ```

3. **Copy the database** (preserves scores, applications, sponsor history):
   ```bash
   scp laptop:.../JobPilot/data/jobs.db data/jobs.db
   ```
   Or start fresh: `npm run db:migrate` then re-run `scripts/ingest-sponsors.ts` (uscis + dol modes) and let the scraper repopulate.

4. **One-shot setup** — installs deps, migrates, installs Chromium, builds, starts PM2:
   ```bash
   bash scripts/setup-mac-mini.sh
   ```

5. **Verify PM2 processes** — expect `web`, `scraper`, `score`, `email-sync` all online:
   ```bash
   pm2 status && pm2 save
   ```

6. **Remote access**: Tailscale (preferred) or LAN IP → `http://<mini>:3000`.

7. **Smoke test**: dashboard loads with real counts; `pm2 logs score --lines 20` shows scoring cycles; `pm2 logs email-sync` shows Gmail sync (not the "not configured" notice); tailor one job end-to-end and confirm the PDF renders.

8. **Retire the laptop instance** — stop any local `next dev`/workers so two scrapers don't double-insert (id dedupe makes this harmless, but it wastes Groq quota).

## Intentionally excluded

- **Apply worker** (`worker/apply.ts`) — manual-submit posture; not in PM2. Start by hand only if ever needed: `npx tsx worker/apply.ts`.

## Quarterly maintenance

- New DOL LCA disclosure quarter: `npx tsx scripts/ingest-sponsors.ts dol <FY> <Q>` then `npx tsx scripts/backfill-classify.ts`.
