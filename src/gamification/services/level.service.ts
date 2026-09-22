import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GamificationLevel, UserXpWallet } from '../../generated/prisma/client';

export interface LevelProgressInfo {
  currentLevel: GamificationLevel;
  nextLevel: GamificationLevel | null;
  totalXp: number;
  engagementXp: number;
  performanceXp: number;
  totalXpForNextLevel: number | null;
  minPerformanceXpForNextLevel: number | null;
  xpNeededForNextLevel: number;
  performanceXpNeededForNextLevel: number;
  progressPercentage: number;
  meetsPerformanceRequirement: boolean;
}

@Injectable()
export class LevelService {
  private readonly logger = new Logger(LevelService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluates if learner qualifies for a level up based on Total XP AND Minimum Performance XP
   */
  async evaluateLevelUp(
    wallet: UserXpWallet,
    txId?: number,
  ): Promise<{ leveledUp: boolean; newLevel: GamificationLevel | null; previousLevelId: number }> {
    const levels = await this.prisma.gamificationLevel.findMany({
      where: { isActive: true },
      orderBy: { levelNumber: 'asc' },
    });

    if (levels.length === 0) {
      return { leveledUp: false, newLevel: null, previousLevelId: wallet.currentLevelId };
    }

    // Determine the highest level the user qualifies for
    // Requirement: totalXp >= minimumTotalXp AND performanceXp >= minimumPerformanceXp
    let eligibleLevel = levels[0];
    for (const lvl of levels) {
      if (
        wallet.totalXp >= lvl.minimumTotalXp &&
        wallet.performanceXp >= lvl.minimumPerformanceXp
      ) {
        eligibleLevel = lvl;
      } else {
        // Since levels are sorted ascending, once a threshold fails, higher levels also fail
        break;
      }
    }

    if (eligibleLevel.id !== wallet.currentLevelId) {
      // Current level changed! Update wallet and create history record
      await this.prisma.userXpWallet.update({
        where: { id: wallet.id },
        data: { currentLevelId: eligibleLevel.id },
      });

      await this.prisma.userLevelHistory.create({
        data: {
          userId: wallet.userId,
          fromLevelId: wallet.currentLevelId,
          toLevelId: eligibleLevel.id,
          triggerTransactionId: txId,
        },
      });

      this.logger.log(
        `User ${wallet.userId} leveled up from ${wallet.currentLevelId} to Level ${eligibleLevel.levelNumber} (${eligibleLevel.title})`,
      );

      return {
        leveledUp: true,
        newLevel: eligibleLevel,
        previousLevelId: wallet.currentLevelId,
      };
    }

    return {
      leveledUp: false,
      newLevel: null,
      previousLevelId: wallet.currentLevelId,
    };
  }

  /**
   * Get comprehensive level progress for user dashboard (PDF §34)
   */
  async getLevelProgress(userId: number): Promise<LevelProgressInfo> {
    const wallet = await this.prisma.userXpWallet.findUnique({
      where: { userId },
      include: { currentLevel: true },
    });

    const allLevels = await this.prisma.gamificationLevel.findMany({
      where: { isActive: true },
      orderBy: { levelNumber: 'asc' },
    });

    const currentLevel =
      wallet?.currentLevel ||
      allLevels[0] || {
        id: 1,
        levelNumber: 1,
        title: 'Beginner',
        minimumTotalXp: 0,
        minimumPerformanceXp: 0,
        icon: null,
        benefits: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

    const nextLevel = allLevels.find((l) => l.levelNumber === currentLevel.levelNumber + 1) || null;

    const totalXp = wallet?.totalXp ?? 0;
    const engagementXp = wallet?.engagementXp ?? 0;
    const performanceXp = wallet?.performanceXp ?? 0;

    let totalXpForNextLevel: number | null = null;
    let minPerformanceXpForNextLevel: number | null = null;
    let xpNeededForNextLevel = 0;
    let performanceXpNeededForNextLevel = 0;
    let progressPercentage = 100;
    let meetsPerformanceRequirement = true;

    if (nextLevel) {
      totalXpForNextLevel = nextLevel.minimumTotalXp;
      minPerformanceXpForNextLevel = nextLevel.minimumPerformanceXp;

      xpNeededForNextLevel = Math.max(0, nextLevel.minimumTotalXp - totalXp);
      performanceXpNeededForNextLevel = Math.max(0, nextLevel.minimumPerformanceXp - performanceXp);
      meetsPerformanceRequirement = performanceXp >= nextLevel.minimumPerformanceXp;

      const xpSpan = nextLevel.minimumTotalXp - currentLevel.minimumTotalXp;
      const userSpan = totalXp - currentLevel.minimumTotalXp;
      progressPercentage = xpSpan > 0 ? Math.min(100, Math.max(0, Math.floor((userSpan / xpSpan) * 100))) : 0;
    }

    return {
      currentLevel,
      nextLevel,
      totalXp,
      engagementXp,
      performanceXp,
      totalXpForNextLevel,
      minPerformanceXpForNextLevel,
      xpNeededForNextLevel,
      performanceXpNeededForNextLevel,
      progressPercentage,
      meetsPerformanceRequirement,
    };
  }
}
