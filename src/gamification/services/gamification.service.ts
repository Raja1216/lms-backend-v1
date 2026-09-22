import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GamificationDomainEvent } from '../events/gamification.event';
import { GamificationEventKey } from '../events/gamification-event.keys';
import { XpRuleEngineService } from './xp-rule-engine.service';
import { LevelService } from './level.service';
import { StreakService } from './streak.service';
import { BadgeService } from './badge.service';
import { LeaderboardService } from './leaderboard.service';
import { ManualXpAdjustmentDto } from '../dto/xp-adjustment.dto';
import { XpType, XpSourceType, UserXpWallet, XpTransaction } from '../../generated/prisma/client';

export interface GamificationEventResult {
  awarded: boolean;
  xpAmount: number;
  xpType: XpType;
  transaction: XpTransaction | null;
  wallet: UserXpWallet | null;
  leveledUp: boolean;
  newLevelTitle?: string;
  streakIncremented: boolean;
  currentStreak: number;
  badgesUnlocked: string[];
}

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleEngine: XpRuleEngineService,
    private readonly levelService: LevelService,
    private readonly streakService: StreakService,
    private readonly badgeService: BadgeService,
    private readonly leaderboardService: LeaderboardService,
  ) {}

  /**
   * PDF §48: Centralized entrypoint for handling all LMS domain gamification events
   */
  async handleDomainEvent(event: GamificationDomainEvent): Promise<GamificationEventResult> {
    this.logger.log(`Processing gamification event: ${event.eventKey} for User ${event.userId}`);

    // 1. Check duplicate/idempotency protection (PDF §40)
    const existingTx = await this.prisma.xpTransaction.findUnique({
      where: { idempotencyKey: event.idempotencyKey },
    });

    if (existingTx) {
      this.logger.warn(`Duplicate event aborted via idempotencyKey: ${event.idempotencyKey}`);
      const wallet = await this.getOrCreateWallet(event.userId);
      return {
        awarded: false,
        xpAmount: 0,
        xpType: existingTx.xpType,
        transaction: existingTx,
        wallet,
        leveledUp: false,
        streakIncremented: false,
        currentStreak: 0,
        badgesUnlocked: [],
      };
    }

    // 2. Evaluate XP Rule Engine
    const ruleEval = await this.ruleEngine.evaluateReward(event);
    let tx: XpTransaction | null = null;
    let wallet: UserXpWallet | null = null;
    let leveledUp = false;
    let newLevelTitle: string | undefined;

    if (ruleEval.awarded && ruleEval.xpAmount > 0) {
      // 3. Atomically record transaction and update dual-XP wallet (EX and PX)
      const result = await this.recordXpTransaction({
        userId: event.userId,
        xpType: ruleEval.xpType,
        xpAmount: ruleEval.xpAmount,
        eventKey: String(event.eventKey),
        sourceType: event.sourceType,
        sourceId: event.sourceId,
        courseId: event.courseId,
        institutionId: event.institutionId,
        idempotencyKey: event.idempotencyKey,
        metadata: {
          ...event.metadata,
          reason: ruleEval.reason,
          ruleId: ruleEval.ruleId,
        },
      });

      tx = result.transaction;
      wallet = result.wallet;

      // 4. Level progression pipeline (PDF §35)
      const levelCheck = await this.levelService.evaluateLevelUp(wallet, tx.id);
      if (levelCheck.leveledUp && levelCheck.newLevel) {
        leveledUp = true;
        newLevelTitle = levelCheck.newLevel.title;
      }
    } else {
      wallet = await this.getOrCreateWallet(event.userId);
    }

    // 5. Streak processing pipeline (PDF §9, §10)
    const streakResult = await this.streakService.processStreakActivity(event);
    if (streakResult.milestoneReached && streakResult.milestoneBonusXp > 0) {
      // Award streak milestone bonus XP!
      await this.recordXpTransaction({
        userId: event.userId,
        xpType: XpType.ENGAGEMENT,
        xpAmount: streakResult.milestoneBonusXp,
        eventKey: `STREAK_${streakResult.milestoneReached}_DAYS`,
        sourceType: XpSourceType.STREAK,
        sourceId: String(streakResult.milestoneReached),
        idempotencyKey: `STREAK_MILESTONE:${event.userId}:${streakResult.milestoneReached}:${new Date().toDateString()}`,
        metadata: { streakDays: streakResult.milestoneReached },
      });
    }

    // 6. Badges & Achievements pipeline (PDF §14-§21)
    const newBadges = await this.badgeService.checkAndAwardBadges(
      event.userId,
      String(event.eventKey),
      event.sourceType,
      event.sourceId,
    );

    return {
      awarded: ruleEval.awarded,
      xpAmount: ruleEval.xpAmount,
      xpType: ruleEval.xpType,
      transaction: tx,
      wallet,
      leveledUp,
      newLevelTitle,
      streakIncremented: streakResult.streakIncremented,
      currentStreak: streakResult.currentStreak,
      badgesUnlocked: newBadges.map((b) => b.name),
    };
  }

  /**
   * PDF §38, §39: Financial-style atomic XP transaction and dual wallet update
   */
  private async recordXpTransaction(params: {
    userId: number;
    xpType: XpType;
    xpAmount: number;
    eventKey: string;
    sourceType: XpSourceType;
    sourceId?: string;
    courseId?: number;
    institutionId?: number;
    idempotencyKey: string;
    metadata?: any;
  }): Promise<{ transaction: XpTransaction; wallet: UserXpWallet }> {
    return await this.prisma.$transaction(async (prisma) => {
      // 1. Insert immutable transaction
      const transaction = await prisma.xpTransaction.create({
        data: {
          userId: params.userId,
          xpType: params.xpType,
          xpAmount: params.xpAmount,
          eventKey: params.eventKey,
          sourceType: params.sourceType,
          sourceId: params.sourceId,
          courseId: params.courseId,
          institutionId: params.institutionId,
          idempotencyKey: params.idempotencyKey,
          metadata: params.metadata,
        },
      });

      // 2. Fetch or create UserXpWallet
      let wallet = await prisma.userXpWallet.findUnique({
        where: { userId: params.userId },
      });

      const exIncrement = params.xpType === XpType.ENGAGEMENT ? params.xpAmount : 0;
      const pxIncrement = params.xpType === XpType.PERFORMANCE ? params.xpAmount : 0;
      const totalIncrement = params.xpAmount;

      if (!wallet) {
        wallet = await prisma.userXpWallet.create({
          data: {
            userId: params.userId,
            engagementXp: Math.max(0, exIncrement),
            performanceXp: Math.max(0, pxIncrement),
            totalXp: Math.max(0, totalIncrement),
            currentLevelId: 1,
          },
        });
      } else {
        wallet = await prisma.userXpWallet.update({
          where: { id: wallet.id },
          data: {
            engagementXp: { increment: exIncrement },
            performanceXp: { increment: pxIncrement },
            totalXp: { increment: totalIncrement },
          },
        });
      }

      return { transaction, wallet };
    });
  }

  /**
   * PDF §54: Manual XP adjustment (compensating positive or negative transaction)
   */
  async adjustXpManually(
    adminUserId: number,
    dto: ManualXpAdjustmentDto,
  ): Promise<XpTransaction> {
    const idempotencyKey = `MANUAL_ADJUSTMENT:U_${dto.userId}:ADMIN_${adminUserId}:${Date.now()}`;

    const { transaction } = await this.recordXpTransaction({
      userId: dto.userId,
      xpType: dto.xpType,
      xpAmount: dto.amount,
      eventKey: GamificationEventKey.MANUAL_XP_ADJUSTMENT,
      sourceType: XpSourceType.ADMIN_ADJUSTMENT,
      sourceId: String(adminUserId),
      idempotencyKey,
      metadata: {
        adminUserId,
        reason: dto.reason,
        reference: dto.reference,
        adjustedAt: new Date(),
      },
    });

    this.logger.log(
      `Admin ${adminUserId} adjusted User ${dto.userId} XP by ${dto.amount} ${dto.xpType}. Reason: ${dto.reason}`,
    );

    return transaction;
  }

  /**
   * Fetch complete learner gamification profile (PDF §51, §60)
   */
  async getLearnerGamificationProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatar: true },
    });

    const levelProgress = await this.levelService.getLevelProgress(userId);
    const streakInfo = await this.streakService.getUserStreak(userId);
    const badges = await this.badgeService.getUserBadgesWithCatalog(userId);

    // Recent 5 transactions
    const recentTransactions = await this.prisma.xpTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      user,
      level: {
        levelNumber: levelProgress.currentLevel.levelNumber,
        title: levelProgress.currentLevel.title,
        nextLevelTitle: levelProgress.nextLevel?.title || null,
        totalXp: levelProgress.totalXp,
        engagementXp: levelProgress.engagementXp,
        performanceXp: levelProgress.performanceXp,
        totalXpRequired: levelProgress.totalXpForNextLevel,
        minimumPerformanceXpRequired: levelProgress.minPerformanceXpForNextLevel,
        xpRemaining: levelProgress.xpNeededForNextLevel,
        pxRemaining: levelProgress.performanceXpNeededForNextLevel,
        progressPercentage: levelProgress.progressPercentage,
        meetsPerformanceRequirement: levelProgress.meetsPerformanceRequirement,
      },
      streak: {
        currentDays: streakInfo.currentStreak,
        longestDays: streakInfo.longestStreak,
        completedToday: streakInfo.completedToday,
      },
      badges: {
        totalEarned: badges.filter((b) => b.isEarned).length,
        catalog: badges,
      },
      recentTransactions,
    };
  }

  async getOrCreateWallet(userId: number): Promise<UserXpWallet> {
    let wallet = await this.prisma.userXpWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      wallet = await this.prisma.userXpWallet.create({
        data: {
          userId,
          engagementXp: 0,
          performanceXp: 0,
          totalXp: 0,
          currentLevelId: 1,
        },
      });
    }

    return wallet;
  }

  async getTransactions(userId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      this.prisma.xpTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.xpTransaction.count({ where: { userId } }),
    ]);

    return {
      transactions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
