import 'dotenv/config';
import { prisma } from '../infrastructure/prisma.js';
import { PersonService } from '../application/person/person.service.js';
import { PrismaPersonRepository } from '../infrastructure/prisma-person.repository.js';
import { PrismaIdentityLookup } from '../infrastructure/prisma-accountability.repository.js';

async function snapshot(label: string) {
  const [
    persons,
    participants,
    users,
    accountabilities,
    participantsWithoutPerson,
    usersWithoutPerson,
    accWithoutPerson,
  ] = await Promise.all([
    prisma.person.count(),
    prisma.activityParticipant.count(),
    prisma.identityUser.count(),
    prisma.accountability.count(),
    prisma.activityParticipant.count({ where: { personId: null } }),
    prisma.identityUser.count({ where: { person: null } }),
    prisma.accountability.count({ where: { personId: null } }),
  ]);
  const phones = await prisma.activityParticipant.findMany({ select: { phone: true, name: true } });
  const uniquePhones = new Set(phones.map((p) => p.phone).filter(Boolean)).size;
  const uniqueNames = new Set(phones.map((p) => p.name.trim().toLowerCase())).size;
  const out = {
    label,
    persons,
    participants,
    users,
    accountabilities,
    participantsWithoutPerson,
    usersWithoutPerson,
    accWithoutPerson,
    uniquePhones,
    uniqueNames,
  };
  console.log(JSON.stringify(out, null, 2));
  return out;
}

async function main() {
  const before = await snapshot('before');
  const persons = new PrismaPersonRepository();
  const identity = new PrismaIdentityLookup();
  const service = new PersonService(persons, identity);

  const users = await prisma.identityUser.findMany({ include: { person: true } });
  for (const user of users) {
    if (user.person) continue;
    await service.ensureForUser({
      id: user.id,
      email: user.email,
      name: user.name,
      module: user.module,
      roleName: user.roleName,
      isActive: user.isActive,
    });
  }

  const unmatched = await prisma.activityParticipant.findMany({ where: { personId: null } });
  for (const row of unmatched) {
    const resolved = await service.resolveForParticipant({
      name: row.name,
      phone: row.phone,
      title: row.title,
    });
    await prisma.activityParticipant.update({
      where: { id: row.id },
      data: { personId: resolved.person.id },
    });
  }

  const accs = await prisma.accountability.findMany({ where: { personId: null } });
  for (const row of accs) {
    const actor = await identity.getById(row.submittedById);
    if (!actor) continue;
    const person = await service.ensureForUser(actor);
    await prisma.accountability.update({ where: { id: row.id }, data: { personId: person.id } });
  }

  const after = await snapshot('after');
  console.log(
    JSON.stringify(
      {
        createdPersons: after.persons - before.persons,
        remainingParticipantsWithoutPerson: after.participantsWithoutPerson,
        remainingUsersWithoutPerson: after.usersWithoutPerson,
        remainingAccWithoutPerson: after.accWithoutPerson,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
