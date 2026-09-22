import { PrismaService } from '../../prisma/prisma.service';
import { seedGamification } from './gamification.seeder';

const prisma = new PrismaService();

async function main() {
  try {
    await prisma.$connect();
    await seedGamification(prisma as any);
  } catch (err) {
    console.error('Error running gamification seed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
