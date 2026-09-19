import 'dotenv/config';
import pg from 'pg';
import { prisma } from '../infrastructure/prisma.js';
import { config } from '../config.js';

export async function validateMigration() {
  const finance = new pg.Client({ connectionString: config.financeDatabaseUrl });
  await finance.connect();
  try {
    const fa = await finance.query(`SELECT COUNT(*)::int AS n FROM "FinanceActivity"`);
    const fp = await finance.query(`SELECT participants FROM "FinanceActivity"`);
    let financeParticipantRows = 0;
    for (const row of fp.rows) {
      const parsed = row.participants;
      if (Array.isArray(parsed)) financeParticipantRows += parsed.filter((p: { name?: string }) => p && String(p.name || '').trim()).length;
    }
    const fe = await finance.query(`SELECT COUNT(*)::int AS n FROM finance_activity_event WHERE activity_id IS NOT NULL`);
    const fr = await finance.query(`SELECT COUNT(*)::int AS n FROM "FinanceActivity" WHERE report_path IS NOT NULL AND report_path <> ''`);
    const statuses = await finance.query(`SELECT COALESCE(status,'planned') AS status, COUNT(*)::int AS n FROM "FinanceActivity" GROUP BY 1`);

    const migratedIds = (await prisma.activity.findMany({ where: { financeActivityId: { not: null } }, select: { id: true } })).map((a) => a.id);
    const amsA = migratedIds.length;
    const amsP = await prisma.activityParticipant.count({ where: { activity: { financeActivityId: { not: null } } } });
    const amsD = await prisma.activityDocument.count({
      where: { kind: 'activity_report', activity: { financeActivityId: { not: null } } },
    });
    const amsE = await prisma.activityEvent.count({ where: { activityId: { in: migratedIds.length ? migratedIds : ['__none__'] } } });
    const amsStatus = await prisma.activity.groupBy({ by: ['status'], _count: true });
    const orphans = await prisma.activity.count({
      where: { financeActivityId: { not: null }, createdById: { notIn: (await prisma.identityUser.findMany({ select: { id: true } })).map((u) => u.id) } },
    });
    const dupes = await prisma.activity.groupBy({
      by: ['financeActivityId'],
      where: { financeActivityId: { not: null } },
      _count: true,
      having: { financeActivityId: { _count: { gt: 1 } } },
    });

    const report = {
      source: { activities: fa.rows[0].n, namedParticipants: financeParticipantRows, events: fe.rows[0].n, reports: fr.rows[0].n, statuses: statuses.rows },
      target: { migratedActivities: amsA, participants: amsP, reportDocuments: amsD, events: amsE, statuses: amsStatus, orphanCreators: orphans, duplicateFinanceIds: dupes.length },
      ok:
        fa.rows[0].n === amsA &&
        financeParticipantRows === amsP &&
        fr.rows[0].n === amsD &&
        dupes.length === 0,
      notes: 'Event counts may differ when Finance events point at deleted activities. FinanceActivity was not deleted.',
    };
    return report;
  } finally {
    await finance.end();
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.includes('validate-migration')) {
  validateMigration()
    .then((r) => {
      console.log(JSON.stringify(r, null, 2));
      if (!r.ok) process.exit(2);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
