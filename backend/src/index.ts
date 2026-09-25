import { assertRuntimeConfig, config } from './config.js';
import { createApp } from './app.js';
import { prisma } from './infrastructure/prisma.js';

const problems = assertRuntimeConfig();
if (problems.length) {
  console.error(`AMS cannot start:\n${problems.map((problem) => `- ${problem}`).join('\n')}`);
  process.exit(1);
}

const app = createApp();
const server = app.listen(config.port, config.host, () => {
  console.log(`AMS Activity API listening on ${config.host}:${config.port}`);
});

function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
