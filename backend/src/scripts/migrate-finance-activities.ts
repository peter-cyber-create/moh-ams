import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { prisma } from '../infrastructure/prisma.js';
import { sanitizeParticipants } from '../domain/activity/participants.js';
import { config } from '../config.js';

function parsePackedDescription(description: string | null) {
  if (!description) return { requestedBy: null as string | null, departmentName: null as string | null, location: null as string | null };
  const match = description.match(/^Requested by: (.*) \((.*)\)(?: · (.*))?$/);
  if (!match) return { requestedBy: null, departmentName: null, location: null };
  return {
    requestedBy: match[1] || null,
    departmentName: match[2] || null,
    location: match[3] || null,
  };
}

function financeUploadDirs() {
  return [
    path.resolve('/home/peter/Projects/MOH/Dev/inv/backend/backend/uploads/reports'),
    path.resolve('/home/peter/Projects/MOH/Dev/inv/backend/uploads/reports'),
  ];
}

function copyReportFile(reportPath: string | null, destDir: string) {
  if (!reportPath) return;
  const name = path.basename(reportPath);
  for (const dir of financeUploadDirs()) {
    const src = path.join(dir, name);
    if (fs.existsSync(src)) {
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(src, path.join(destDir, name));
      return;
    }
  }
}

export async function migrateFinanceActivities() {
  const startedAt = new Date();
  const finance = new pg.Client({ connectionString: config.financeDatabaseUrl });
  await finance.connect();
  const destDir = path.resolve(process.cwd(), config.uploadDir, 'reports');
  const skipped: string[] = [];
  const counts = {
    users: 0,
    activities: 0,
    participants: 0,
    documents: 0,
    events: 0,
    skippedUnnamedParticipants: 0,
  };

  try {
    const users = await finance.query(`
      SELECT u.id, u.email, u.name, u.username, u.module, u.is_active, u.department_id,
             r.name AS role_name, d.name AS department_name
      FROM "User" u
      LEFT JOIN "Role" r ON r.id = u.role_id
      LEFT JOIN "Department" d ON d.id = u.department_id
    `);
    for (const u of users.rows) {
      await prisma.identityUser.upsert({
        where: { id: u.id },
        update: {
          email: u.email,
          name: u.name,
          username: u.username,
          module: u.module,
          roleName: u.role_name,
          departmentId: u.department_id,
          departmentName: u.department_name,
          isActive: u.is_active,
        },
        create: {
          id: u.id,
          email: u.email,
          name: u.name,
          username: u.username,
          module: u.module,
          roleName: u.role_name,
          departmentId: u.department_id,
          departmentName: u.department_name,
          isActive: u.is_active,
        },
      });
      counts.users += 1;
    }

    const depts = await finance.query(`SELECT id, name FROM "Department"`);
    const deptMap = new Map(depts.rows.map((d: { id: string; name: string }) => [d.id, d.name]));

    const activities = await finance.query(`SELECT * FROM "FinanceActivity"`);
    for (const row of activities.rows) {
      const existing = await prisma.activity.findUnique({ where: { financeActivityId: row.id } });
      if (existing) {
        skipped.push(row.id);
        continue;
      }
      const packed = parsePackedDescription(row.description);
      let participants: ReturnType<typeof sanitizeParticipants> = [];
      const raw = row.participants;
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) {
          const named = parsed.filter((p) => p && String(p.name || '').trim());
          counts.skippedUnnamedParticipants += parsed.length - named.length;
          participants = sanitizeParticipants(named);
        }
      }
      const created = await prisma.activity.create({
        data: {
          financeActivityId: row.id,
          title: row.title,
          description: row.description,
          requestedBy: packed.requestedBy,
          location: packed.location,
          departmentId: row.department_id,
          departmentName: packed.departmentName || deptMap.get(row.department_id) || null,
          activityDate: row.invoice_date,
          budgetAmount: row.amount ?? 0,
          funder: row.funder,
          referenceNumber: row.voucher_number,
          activityType: row.activity_type,
          days: row.days,
          status: (row.status || 'planned').toLowerCase() === 'completed' ? 'report_submitted' : (row.status || 'planned'),
          createdById: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          participants: {
            create: participants.map((p, i) => ({
              name: p.name,
              title: p.title || null,
              phone: p.phone || null,
              amount: p.amount,
              days: p.days,
              sortOrder: i,
            })),
          },
        },
      });
      counts.activities += 1;
      counts.participants += participants.length;

      if (row.report_path) {
        copyReportFile(row.report_path, destDir);
        await prisma.activityDocument.create({
          data: {
            activityId: created.id,
            kind: 'activity_report',
            storedPath: row.report_path,
            originalName: path.basename(row.report_path),
            uploadedById: row.created_by,
          },
        });
        counts.documents += 1;
      }
    }

    const idMap = new Map(
      (await prisma.activity.findMany({ where: { financeActivityId: { not: null } }, select: { id: true, financeActivityId: true } })).map(
        (a) => [a.financeActivityId as string, a.id],
      ),
    );

    const events = await finance.query(`SELECT * FROM finance_activity_event`);
    for (const ev of events.rows) {
      const activityId = ev.activity_id ? idMap.get(ev.activity_id) : null;
      if (!activityId) continue;
      const exists = await prisma.activityEvent.findFirst({
        where: { activityId, createdAt: ev.created_at, action: ev.action },
      });
      if (exists) continue;
      await prisma.activityEvent.create({
        data: {
          activityId,
          action: ev.action,
          summary: ev.summary,
          fromStatus: ev.from_status,
          toStatus: ev.to_status,
          meta: ev.meta ?? undefined,
          actorUserId: ev.actor_user_id,
          createdAt: ev.created_at,
        },
      });
      counts.events += 1;
    }

    await prisma.migrationRun.create({
      data: {
        source: config.financeDatabaseUrl.replace(/:[^:@]+@/, ':****@'),
        startedAt,
        finishedAt: new Date(),
        counts,
        notes: skipped.length ? `Already migrated: ${skipped.length}` : 'ok',
      },
    });
    return { counts, skipped: skipped.length };
  } finally {
    await finance.end();
    await prisma.$disconnect();
  }
}

const isMain = process.argv[1]?.includes('migrate-finance-activities');
if (isMain) {
  migrateFinanceActivities()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
