import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3020', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  databaseUrl: process.env.DATABASE_URL || '',
  financeDatabaseUrl: process.env.FINANCE_DATABASE_URL || '',
  financeApiUrl: process.env.FINANCE_API_URL || 'http://localhost:3000',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
};
