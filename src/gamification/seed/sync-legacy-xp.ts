import { PrismaService } from '../../prisma/prisma.service';
import { XpType, XpSourceType } from '../../generated/prisma/client';

const prisma = new PrismaService();

async function syncLegacyXp() {
  console.log('Starting legacy XP migration and wallet synchronization...');
  await prisma.$connect();

  const allLevels = await prisma.gamificationLevel.findMany({
    where: { isActive: true },
    orderBy: { levelNumber: 'asc' },
  });

  // Find all distinct users with xpEarned
  const userGroups = await prisma.userXPEarned.groupBy({
    by: ['userId'],
  });

  console.log(`Found ${userGroups.length} users with legacy XP records.`);

  for (const group of userGroups) {
    const userId = group.userId;

    const lessonRecords = await prisma.userXPEarned.findMany({
      where: { userId, quizId: null },
    });
    const quizRecords = await prisma.userXPEarned.findMany({
      where: { userId, quizId: { not: null } },
    });

    const exSum = lessonRecords.reduce((s, r) => s + r.xpPoints, 0);
    const pxSum = quizRecords.reduce((s, r) => s + r.xpPoints, 0);
    const totalSum = exSum + pxSum;

    // Determine eligible level
    let eligibleLevel = allLevels[0];
    for (const lvl of allLevels) {
      if (totalSum >= lvl.minimumTotalXp && pxSum >= lvl.minimumPerformanceXp) {
        eligibleLevel = lvl;
      } else {
        break;
      }
    }

    // Upsert UserXpWallet
    await prisma.userXpWallet.upsert({
      where: { userId },
      update: {
        engagementXp: exSum,
        performanceXp: pxSum,
        totalXp: totalSum,
        currentLevelId: eligibleLevel.id,
      },
      create: {
        userId,
        engagementXp: exSum,
        performanceXp: pxSum,
        totalXp: totalSum,
        currentLevelId: eligibleLevel.id,
      },
    });

    // Create a migration transaction record if needed
    const existingTx = await prisma.xpTransaction.findFirst({
      where: { userId, eventKey: 'LEGACY_MIGRATION' },
    });

    if (!existingTx && totalSum > 0) {
      await prisma.xpTransaction.create({
        data: {
          userId,
          xpType: XpType.ENGAGEMENT,
          xpAmount: totalSum,
          eventKey: 'LEGACY_MIGRATION',
          sourceType: XpSourceType.SYSTEM,
          idempotencyKey: `LEGACY_MIGRATION:U_${userId}`,
          metadata: {
            migratedAt: new Date(),
            legacyEx: exSum,
            legacyPx: pxSum,
            legacyTotal: totalSum,
          },
        },
      });
    }

    console.log(
      `User ${userId}: Synced Total XP=${totalSum} (EX=${exSum}, PX=${pxSum}) -> Level ${eligibleLevel.levelNumber} (${eligibleLevel.title})`,
    );
  }

  console.log('Legacy XP synchronization completed!');
  await prisma.$disconnect();
}

syncLegacyXp().catch((err) => {
  console.error('Error during legacy XP sync:', err);
  process.exit(1);
});
