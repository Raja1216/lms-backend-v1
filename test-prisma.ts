// test-prisma.ts
import { PrismaClient } from './src/generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const adapter = new PrismaMariaDb({
  url: process.env.DATABASE_URL,
} as unknown as any);

const prisma = new PrismaClient({
  adapter,
  log: ['info'],
} as any);

async function main() {
  try {
    console.log('ENV DATABASE_URL:', process.env.DATABASE_URL);
    console.time('connect');
    await prisma.$connect();
    console.timeEnd('connect');
    const r = await prisma.$queryRaw`SELECT 1 AS v`;
    console.log('Query result:', r);
  } catch (err) {
    console.error('Prisma test error:', err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
