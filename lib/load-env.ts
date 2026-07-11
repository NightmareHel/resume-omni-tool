// Load .env.local for GROQ_API_KEY etc. Next.js auto-loads it for the web
// server, but raw tsx workers and scripts do not. Import this first in any
// worker/script entry point (side-effect import).
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length && !k.trim().startsWith('#') && process.env[k.trim()] === undefined) {
      process.env[k.trim()] = v.join('=').trim();
    }
  }
}
