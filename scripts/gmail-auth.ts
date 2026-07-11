/**
 * One-time Gmail OAuth consent flow. Run with: npx tsx scripts/gmail-auth.ts
 *
 * Prereq: create an OAuth client (type: Desktop app) in Google Cloud Console
 * with the Gmail API enabled, then put these in .env.local:
 *   GMAIL_CLIENT_ID=...
 *   GMAIL_CLIENT_SECRET=...
 *
 * This script opens a consent URL, catches the redirect on localhost:8765,
 * exchanges the code, and appends GMAIL_REFRESH_TOKEN to .env.local.
 * Scope is gmail.readonly — the worker only ever reads.
 */
import '../lib/load-env';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

const PORT = 8765;
const REDIRECT = `http://localhost:${PORT}/oauth2callback`;

async function main() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('Missing GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET in .env.local');
    console.error('Create a Desktop-app OAuth client at https://console.cloud.google.com/apis/credentials (enable the Gmail API first).');
    process.exit(1);
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT);
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force refresh_token issuance even on re-consent
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
  });

  console.log('\nOpen this URL in your browser and approve access:\n');
  console.log(authUrl + '\n');

  const code: string = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', REDIRECT);
      if (url.pathname !== '/oauth2callback') { res.writeHead(404).end(); return; }
      const c = url.searchParams.get('code');
      if (!c) { res.writeHead(400).end('Missing code'); reject(new Error('No code in callback')); return; }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h2>JobPilot Gmail connected. You can close this tab.</h2>');
      server.close();
      resolve(c);
    });
    server.listen(PORT, () => console.log(`Waiting for the OAuth redirect on ${REDIRECT} ...`));
    setTimeout(() => { server.close(); reject(new Error('Timed out after 5 minutes')); }, 5 * 60_000);
  });

  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    console.error('No refresh_token returned — remove prior consent at https://myaccount.google.com/permissions and retry.');
    process.exit(1);
  }

  const envPath = path.join(process.cwd(), '.env.local');
  let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  if (/^GMAIL_REFRESH_TOKEN=/m.test(env)) {
    env = env.replace(/^GMAIL_REFRESH_TOKEN=.*$/m, `GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
  } else {
    env += (env.endsWith('\n') || env === '' ? '' : '\n') + `GMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`;
  }
  fs.writeFileSync(envPath, env);
  console.log('\nGMAIL_REFRESH_TOKEN written to .env.local — email sync is ready.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
