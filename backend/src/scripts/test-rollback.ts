import 'dotenv/config';
import pg from 'pg';
import { config } from '../config.js';

/** Wave 1 does not delete FinanceActivity. Rollback = keep using Finance dump + leave ams_db. */
async function main() {
  const finance = new pg.Client({ connectionString: config.financeDatabaseUrl });
  await finance.connect();
  try {
    const n = await finance.query(`SELECT COUNT(*)::int AS n FROM "FinanceActivity"`);
    console.log(JSON.stringify({ financeActivityStillPresent: n.rows[0].n >= 0, count: n.rows[0].n, rollback: 'Finance tables were not dropped' }));
  } finally {
    await finance.end();
  }
}

main();
