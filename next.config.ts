import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'mammoth', 'better-sqlite3', 'playwright', 'playwright-core'],
};

export default nextConfig;
