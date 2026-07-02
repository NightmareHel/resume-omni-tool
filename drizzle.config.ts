import type { Config } from 'drizzle-kit';
import path from 'path';

export default {
  schema: './lib/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'jobs.db'),
  },
} satisfies Config;
