import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const nodeEnv = process.env.NODE_ENV || 'development';
const production = nodeEnv === 'production';

function list(value: string | undefined, fallback: string) {
  return (value ?? fallback)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const config = {
  nodeEnv,
  production,
  host: process.env.HOST || '0.0.0.0',
  port: parseInt(process.env.PORT || '3020', 10),
  jwtSecret: process.env.JWT_SECRET || (production ? '' : 'dev-secret'),
  databaseUrl: process.env.DATABASE_URL || '',
  financeDatabaseUrl: process.env.FINANCE_DATABASE_URL || '',
  financeApiUrl: process.env.FINANCE_API_URL || (production ? '' : 'http://localhost:3000'),
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  webDist: process.env.WEB_DIST || '',
  corsOrigins: list(
    process.env.CORS_ORIGINS,
    production ? '' : 'http://localhost:3010,http://127.0.0.1:3010,http://localhost:4173',
  ),
};

const PLACEHOLDER_SECRETS = new Set(['', 'dev-secret', 'same-as-finance-jwt-secret', 'change-me']);

export function assertRuntimeConfig() {
  const problems: string[] = [];
  if (!config.production) return problems;
  if (!config.databaseUrl) problems.push('DATABASE_URL is required.');
  if (PLACEHOLDER_SECRETS.has(config.jwtSecret)) {
    problems.push('JWT_SECRET must match the Finance identity service secret.');
  }
  if (!config.financeApiUrl) problems.push('FINANCE_API_URL is required.');
  if (config.corsOrigins.length === 0) problems.push('CORS_ORIGINS is required.');
  if (config.webDist && !fs.existsSync(path.resolve(config.webDist))) {
    problems.push('WEB_DIST does not exist.');
  }
  return problems;
}
