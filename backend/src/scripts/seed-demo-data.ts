import 'dotenv/config';
import { prisma } from '../infrastructure/prisma.js';
import { formatReference } from '../domain/accountability/statuses.js';

const FORCE = process.argv.includes('--force');
const YEAR = new Date().getUTCFullYear();

const REGIONS = ['Central', 'Eastern', 'Northern', 'Western'];
const DISTRICTS: Record<string, string[]> = {
  Central: ['Kampala', 'Wakiso', 'Mukono', 'Masaka'],
  Eastern: ['Jinja', 'Mbale', 'Soroti', 'Tororo'],
  Northern: ['Gulu', 'Lira', 'Arua', 'Kitgum'],
  Western: ['Mbarara', 'Fort Portal', 'Kabale', 'Hoima'],
};
const DEPARTMENTS = [
  'Health Promotion',
  'Clinical Services',
  'ICT',
  'Finance & Accounts',
  'Human Resources',
  'Public Health',
  'Disease Surveillance',
];
const FUNDERS = ['GOU', 'GF-HIV', 'GF-MALARIA', 'GAVI', 'CDC', 'WHO', 'UCREPP'];
const ACTIVITY_TYPES = [
  'Field supervision',
  'Support visit',
  'Training workshop',
  'Data verification',
  'Outreach campaign',
  'Monitoring visit',
];
const FIRST = ['James', 'Sarah', 'Peter', 'Grace', 'Moses', 'Amina', 'David', 'Ruth', 'Joseph', 'Mary', 'Emmanuel', 'Joyce', 'Samuel', 'Betty', 'Daniel', 'Faith', 'Patrick', 'Irene', 'Robert', 'Jane'];
const LAST = ['Okello', 'Nabukeera', 'Mukasa', 'Achieng', 'Kato', 'Namuli', 'Wasswa', 'Atim', 'Odeke', 'Nalwoga', 'Ssemwogerere', 'Akello', 'Tumusiime', 'Nabirye', 'Opio', 'Kyomuhendo', 'Lubega', 'Among', 'Byaruhanga', 'Nakiwala'];
const DESIGNATIONS = ['Team Leader', 'Support Officer - ICT', 'Driver', 'Data Officer', 'Clinical Officer', 'Health Educator'];

function pick<T>(arr: T[], i: number) {
  return arr[i % arr.length];
}

function randInt(min: number, max: number, seed: number) {
  return min + (seed * 17 + 13) % (max - min + 1);
}

function dateInYear(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function phoneFor(i: number) {
  const local = `2567${String(10000000 + i).slice(-8)}`;
  return { display: `0${local.slice(3)}`, normalized: local };
}

function personRef(seq: number) {
  return `MOH-P-${String(seq).padStart(6, '0')}`;
}

async function nextPersonRef() {
  const row = await prisma.personSequence.upsert({
    where: { id: 1 },
    create: { id: 1, last: 0 },
    update: {},
  });
  const last = row.last + 1;
  await prisma.personSequence.update({ where: { id: 1 }, data: { last } });
  return personRef(last);
}

async function nextAccRef(year: number) {
  const row = await prisma.accountabilitySequence.upsert({
    where: { year },
    create: { year, last: 0 },
    update: {},
  });
  const last = row.last + 1;
  await prisma.accountabilitySequence.update({ where: { year }, data: { last } });
  return formatReference(year, last);
}

async function ensureIdentityUsers() {
  const existing = await prisma.identityUser.findMany();
  if (existing.length >= 2) return existing;
  const demo = [
    { id: 'seed-officer-1', email: 'officer.demo@moh.go.ug', name: 'Demo Officer', module: 'Finance', roleName: 'User' },
    { id: 'seed-reviewer-1', email: 'reviewer.demo@moh.go.ug', name: 'Demo Reviewer', module: 'Finance', roleName: 'Reviewer' },
    { id: 'seed-admin-1', email: 'admin.demo@moh.go.ug', name: 'Demo Admin', module: 'Admin', roleName: 'Admin' },
  ];
  for (const u of demo) {
    await prisma.identityUser.upsert({
      where: { id: u.id },
      create: { ...u, isActive: true },
      update: u,
    });
  }
  return prisma.identityUser.findMany();
}

async function main() {
  const existingActivities = await prisma.activity.count({ where: { financeActivityId: { startsWith: 'demo-' } } });
  if (existingActivities >= 50 && !FORCE) {
    console.log(`Demo data already present (${existingActivities} demo activities). Use --force to re-seed.`);
    return;
  }

  if (FORCE) {
    console.log('Clearing prior demo data…');
    await prisma.activityBudgetLine.deleteMany({ where: { activity: { financeActivityId: { startsWith: 'demo-' } } } });
    await prisma.activityTravel.deleteMany({ where: { activity: { financeActivityId: { startsWith: 'demo-' } } } });
    await prisma.activityFacility.deleteMany({ where: { activity: { financeActivityId: { startsWith: 'demo-' } } } });
    await prisma.activityTeamMember.deleteMany({ where: { team: { activity: { financeActivityId: { startsWith: 'demo-' } } } } });
    await prisma.activityTeam.deleteMany({ where: { activity: { financeActivityId: { startsWith: 'demo-' } } } });
    await prisma.accountability.deleteMany({ where: { activity: { financeActivityId: { startsWith: 'demo-' } } } });
    await prisma.activityParticipant.deleteMany({ where: { activity: { financeActivityId: { startsWith: 'demo-' } } } });
    await prisma.activityDocument.deleteMany({ where: { activity: { financeActivityId: { startsWith: 'demo-' } } } });
    await prisma.activityEvent.deleteMany({ where: { activity: { financeActivityId: { startsWith: 'demo-' } } } });
    await prisma.activity.deleteMany({ where: { financeActivityId: { startsWith: 'demo-' } } });
  }

  const users = await ensureIdentityUsers();
  const officers = users.filter((u) => String(u.roleName || '').toLowerCase().includes('user') || String(u.module || '').toLowerCase() === 'finance');
  const reviewers = users.filter((u) => String(u.roleName || '').toLowerCase().includes('review'));
  const officer = officers[0] || users[0];
  const reviewer = reviewers[0] || users.find((u) => u.id !== officer.id) || officer;

  console.log(`Seeding with officer=${officer.email}, reviewer=${reviewer.email}`);

  const PERSON_TARGET = 420;
  const persons: { id: string; fullName: string; phone: string | null; phoneNormalized: string | null }[] = [];

  for (let i = 0; i < PERSON_TARGET; i++) {
    const name = `${pick(FIRST, i)} ${pick(LAST, i * 3 + 7)}`;
    const phone = i % 7 === 0 ? null : phoneFor(i + 100);
    const ref = await nextPersonRef();
    const row = await prisma.person.create({
      data: {
        personReference: ref,
        fullName: name,
        phone: phone?.display ?? null,
        phoneNormalized: phone?.normalized ?? null,
        organisation: pick(DEPARTMENTS, i),
        title: pick(DESIGNATIONS, i),
        departmentName: pick(DEPARTMENTS, i + 2),
        identityStatus: phone ? 'verified' : 'unverified',
        status: 'active',
      },
    });
    persons.push({ id: row.id, fullName: name, phone: phone?.display ?? null, phoneNormalized: phone?.normalized ?? null });
  }

  const statusPlan: string[] = [
    ...Array(15).fill('planned'),
    ...Array(20).fill('ongoing'),
    ...Array(25).fill('report_submitted'),
    ...Array(45).fill('closed'),
    ...Array(10).fill('cancelled'),
    ...Array(5).fill('draft'),
  ];
  while (statusPlan.length < 120) statusPlan.push(pick(['planned', 'ongoing', 'closed', 'report_submitted'], statusPlan.length));

  const activities: { id: string; status: string; budget: number }[] = [];
  let participantCount = 0;

  for (let i = 0; i < 120; i++) {
    const region = pick(REGIONS, i);
    const district = pick(DISTRICTS[region], i);
    const month = (i % 12) + 1;
    const day = (i % 25) + 1;
    const actYear = i < 20 ? YEAR - 1 : YEAR;
    const start = dateInYear(actYear, month, day);
    const duration = randInt(1, 5, i);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + duration - 1);
    const status = statusPlan[i];
    const budget = randInt(500_000, 8_000_000, i * 11);
    const creator = i % 3 === 0 ? reviewer.id : officer.id;

    const activity = await prisma.activity.create({
      data: {
        financeActivityId: `demo-${i + 1}`,
        title: `${pick(ACTIVITY_TYPES, i)} — ${district} ${actYear}`,
        description: `Demo activity ${i + 1} for ${region} region supervision and support.`,
        requestedBy: officer.name,
        location: `${district}, ${region}`,
        departmentName: pick(DEPARTMENTS, i),
        activityDate: start,
        endDate: end,
        budgetAmount: budget,
        funder: pick(FUNDERS, i),
        referenceNumber: `MOH/ACT/${actYear}/${String(i + 1).padStart(4, '0')}`,
        activityType: pick(ACTIVITY_TYPES, i + 1),
        days: duration,
        status,
        createdById: creator,
        events: {
          create: [{ action: 'created', summary: 'Demo activity seeded', actorUserId: creator }],
        },
      },
    });

    if (status === 'report_submitted' || status === 'closed') {
      await prisma.activityDocument.create({
        data: {
          activityId: activity.id,
          kind: 'activity_report',
          storedPath: `/uploads/demo/report-${activity.id}.pdf`,
          originalName: `activity-report-${i + 1}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 12000,
          uploadedById: creator,
        },
      });
    }

    const pCount = randInt(3, 7, i);
    for (let p = 0; p < pCount; p++) {
      const person = persons[(i * 3 + p * 17) % persons.length];
      const days = randInt(1, 4, i + p);
      await prisma.activityParticipant.create({
        data: {
          activityId: activity.id,
          personId: person.id,
          name: person.fullName,
          phone: person.phone,
          title: pick(DESIGNATIONS, p),
          amount: randInt(50_000, 400_000, i * p),
          days,
          sortOrder: p,
        },
      });
      participantCount++;
    }

    activities.push({ id: activity.id, status, budget });

    if (i % 3 === 0) {
      await prisma.activityFacility.create({
        data: {
          activityId: activity.id,
          region: region,
          district,
          facility: `${district} HC ${(i % 5) + 1}`,
          facilityCode: `HC-${district.slice(0, 3).toUpperCase()}-${i % 20}`,
        },
      });
    }

    if (i % 2 === 0) {
      const team = await prisma.activityTeam.create({
        data: {
          activityId: activity.id,
          teamCode: `T${(i % 10) + 1}`,
          teamName: `${pick(DEPARTMENTS, i)} Team ${(i % 4) + 1}`,
          leaderPersonId: persons[i % persons.length].id,
        },
      });
      const rate = randInt(30_000, 80_000, i);
      const frequency = randInt(3, 10, i + 1);
      const perDiem = rate * frequency;
      const fuel = randInt(100_000, 350_000, i + 2);
      const calculated = perDiem + fuel + randInt(20_000, 60_000, i + 3);
      const supplied = i % 5 === 0 ? calculated + randInt(-5000, 5000, i) : calculated;
      await prisma.activityTeamMember.create({
        data: {
          teamId: team.id,
          personId: persons[(i + 5) % persons.length].id,
          designation: pick(DESIGNATIONS, i),
          organisation: pick(DEPARTMENTS, i),
          phone: phoneFor(i + 200).display,
          rate,
          airtimeData: randInt(10_000, 30_000, i),
          frequency,
          perDiem,
          fuelAllocation: fuel,
          suppliedTotal: supplied,
          calculatedTotal: calculated,
        },
      });
      const litres = randInt(20, 80, i);
      const fuelRate = 5500;
      const fuelAmount = litres * fuelRate;
      await prisma.activityTravel.create({
        data: {
          activityId: activity.id,
          teamId: team.id,
          region: region,
          facility: `${district} HC`,
          fromLocation: district,
          toLocation: `${pick(DISTRICTS[region], i + 1)} outreach`,
          kilometres: randInt(30, 250, i),
          litres,
          fuelRate,
          fuelAmount,
          suppliedFuelAmount: i % 4 === 0 ? fuelAmount + 1000 : fuelAmount,
        },
      });
      await prisma.activityBudgetLine.create({
        data: {
          activityId: activity.id,
          teamId: team.id,
          category: 'Per diem',
          description: 'Team field days',
          quantity: frequency,
          rate,
          amount: perDiem,
          suppliedAmount: perDiem,
          calculatedAmount: rate * frequency,
        },
      });
    }
  }

  // Compliance edge cases — dedicated participation patterns for first 30 persons
  const edgeActivities: { personIdx: number; days: number; month: number; startDay: number }[] = [
    { personIdx: 0, days: 5, month: 3, startDay: 1 },
    { personIdx: 0, days: 4, month: 3, startDay: 4 },
    { personIdx: 1, days: 20, month: 6, startDay: 1 },
    { personIdx: 2, days: 120, month: 1, startDay: 1 },
    { personIdx: 3, days: 150, month: 2, startDay: 1 },
    { personIdx: 4, days: 155, month: 4, startDay: 1 },
    { personIdx: 5, days: 10, month: 12, startDay: 20 },
    { personIdx: 5, days: 12, month: 12, startDay: 28 },
  ];

  for (let e = 0; e < edgeActivities.length; e++) {
    const spec = edgeActivities[e];
    const person = persons[spec.personIdx];
    const start = dateInYear(YEAR, spec.month, spec.startDay);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + spec.days - 1);
    const act = await prisma.activity.create({
      data: {
        financeActivityId: `demo-edge-${e + 1}`,
        title: `Compliance edge case ${e + 1} — ${person.fullName}`,
        departmentName: 'Public Health',
        activityDate: start,
        endDate: end,
        budgetAmount: 500_000,
        funder: 'GOU',
        status: 'closed',
        createdById: officer.id,
        days: spec.days,
        participants: {
          create: [{ personId: person.id, name: person.fullName, phone: person.phone, days: spec.days, amount: 100_000, sortOrder: 0 }],
        },
        documents: {
          create: {
            kind: 'activity_report',
            storedPath: `/uploads/demo/edge-${e}.pdf`,
            originalName: `edge-${e}.pdf`,
            mimeType: 'application/pdf',
          },
        },
      },
    });
    activities.push({ id: act.id, status: 'closed', budget: 500_000 });
    participantCount++;
  }

  const accStatuses: string[] = [
    ...Array(8).fill('draft'),
    ...Array(12).fill('submitted'),
    ...Array(14).fill('under_review'),
    ...Array(8).fill('returned'),
    ...Array(6).fill('resubmitted'),
    ...Array(5).fill('clarification_requested'),
    ...Array(4).fill('rejected'),
    ...Array(15).fill('approved'),
    ...Array(10).fill('closed'),
  ];
  while (accStatuses.length < 85) accStatuses.push('submitted');

  const closedActivities = activities.filter((a) => a.status === 'closed' || a.status === 'report_submitted');
  let accCreated = 0;

  for (let i = 0; i < 85; i++) {
    const activity = closedActivities[i % closedActivities.length];
    if (!activity) break;
    const actRow = await prisma.activity.findUnique({ where: { id: activity.id }, include: { participants: true } });
    if (!actRow) continue;
    const submitter = actRow.createdById;
    const person = actRow.participants[0]?.personId ? persons.find((p) => p.id === actRow.participants[0].personId) : persons[i % persons.length];
    const status = accStatuses[i];
    const due = new Date();
    due.setUTCDate(due.getUTCDate() + (i % 20) - 10);
    const ref = await nextAccRef(YEAR);
    const advanced = Number(actRow.budgetAmount);

    const acc = await prisma.accountability.create({
      data: {
        referenceNumber: ref,
        activityId: actRow.id,
        personId: person?.id ?? null,
        status,
        amountAdvanced: advanced,
        amountReturned: status === 'approved' || status === 'closed' ? randInt(0, Math.floor(advanced * 0.2), i) : 0,
        dueDate: due,
        submittedById: submitter,
        submittedAt: ['draft'].includes(status) ? null : new Date(due.getTime() - 86400000 * 5),
        reviewerId: ['under_review', 'returned', 'resubmitted', 'clarification_requested', 'approved', 'closed'].includes(status)
          ? reviewer.id
          : null,
        assignedAt: ['under_review', 'approved', 'closed'].includes(status) ? new Date() : null,
        approvedAt: ['approved', 'closed'].includes(status) ? new Date() : null,
        approvedById: ['approved', 'closed'].includes(status) ? reviewer.id : null,
        closedAt: status === 'closed' ? new Date() : null,
        returnReason: status === 'returned' ? 'Missing supporting receipt' : null,
        lines: {
          create: [
            { kind: 'expenditure', description: 'Field facilitation', amount: advanced * 0.6, sortOrder: 0 },
            { kind: 'expenditure', description: 'Transport', amount: advanced * 0.25, sortOrder: 1 },
          ],
        },
        events: {
          create: [{ action: 'seed', summary: `Demo accountability ${status}`, actorUserId: submitter }],
        },
      },
    });

    if (status === 'clarification_requested') {
      await prisma.accountabilityClarification.create({
        data: {
          accountabilityId: acc.id,
          question: 'Please clarify transport line items.',
          requestedById: reviewer.id,
          status: 'open',
        },
      });
    }
    accCreated++;
  }

  await prisma.migrationRun.create({
    data: {
      source: 'seed-demo-data',
      startedAt: new Date(),
      finishedAt: new Date(),
      counts: {
        persons: persons.length,
        activities: activities.length,
        participants: participantCount,
        accountabilities: accCreated,
      },
      notes: `Synthetic MOH demo seed for ${YEAR}`,
    },
  });

  const summary = {
    persons: await prisma.person.count(),
    activities: await prisma.activity.count(),
    participants: await prisma.activityParticipant.count(),
    accountabilities: await prisma.accountability.count(),
    teams: await prisma.activityTeam.count(),
    facilities: await prisma.activityFacility.count(),
    travels: await prisma.activityTravel.count(),
    budgetLines: await prisma.activityBudgetLine.count(),
  };
  console.log('Seed complete:', JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
