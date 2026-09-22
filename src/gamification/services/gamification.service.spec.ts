import { Test, TestingModule } from '@nestjs/testing';
import { GamificationService } from './gamification.service';
import { XpRuleEngineService } from './xp-rule-engine.service';
import { LevelService } from './level.service';
import { StreakService } from './streak.service';
import { BadgeService } from './badge.service';
import { LeaderboardService } from './leaderboard.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GamificationDomainEvent } from '../events/gamification.event';
import { GamificationEventKey } from '../events/gamification-event.keys';
import { XpSourceType, XpType } from '../../generated/prisma/client';

describe('GamificationService', () => {
  let service: GamificationService;
  let ruleEngine: XpRuleEngineService;
  let levelService: LevelService;
  let streakService: StreakService;
  let prisma: PrismaService;

  const mockPrisma = {
    xpTransaction: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    userXpWallet: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    gamificationXpRule: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    gamificationLevel: {
      findMany: jest.fn(),
    },
    userLevelHistory: {
      create: jest.fn(),
    },
    userStreak: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    streakHistory: {
      upsert: jest.fn(),
    },
    badge: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    userBadge: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrisma)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        XpRuleEngineService,
        LevelService,
        StreakService,
        BadgeService,
        LeaderboardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<GamificationService>(GamificationService);
    ruleEngine = module.get<XpRuleEngineService>(XpRuleEngineService);
    levelService = module.get<LevelService>(LevelService);
    streakService = module.get<StreakService>(StreakService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('Idempotency & Duplicate Protection (PDF §40)', () => {
    it('should reject duplicate event if idempotencyKey already exists', async () => {
      const event = new GamificationDomainEvent({
        userId: 1,
        eventKey: GamificationEventKey.LESSON_VIDEO_COMPLETED,
        sourceType: XpSourceType.LESSON,
        sourceId: 101,
        idempotencyKey: 'LESSON_COMPLETED:U_1:LESSON_101',
      });

      // Mock existing transaction
      mockPrisma.xpTransaction.findUnique.mockResolvedValue({
        id: 99,
        userId: 1,
        xpAmount: 10,
        xpType: XpType.ENGAGEMENT,
        idempotencyKey: 'LESSON_COMPLETED:U_1:LESSON_101',
      });

      mockPrisma.userXpWallet.findUnique.mockResolvedValue({
        id: 1,
        userId: 1,
        engagementXp: 50,
        performanceXp: 100,
        totalXp: 150,
        currentLevelId: 1,
      });

      const result = await service.handleDomainEvent(event);

      expect(result.awarded).toBe(false);
      expect(result.xpAmount).toBe(0);
      expect(mockPrisma.xpTransaction.create).not.toHaveBeenCalled();
    });
  });

  describe('Non-Stacking Bonus Calculations (PDF §6.2, §7.2, §8.1)', () => {
    it('should calculate non-stacking highest quiz score bonus', () => {
      // 100% score should award +75 PX, NOT 20 + 40 + 75
      const res100 = ruleEngine.calculateQuizBonus(100, null);
      expect(res100.scoreBonusPx).toBe(75);

      // 95% score should award +40 PX
      const res95 = ruleEngine.calculateQuizBonus(95, null);
      expect(res95.scoreBonusPx).toBe(40);

      // 85% score should award +20 PX
      const res85 = ruleEngine.calculateQuizBonus(85, null);
      expect(res85.scoreBonusPx).toBe(20);

      // 70% score should award 0 score bonus
      const res70 = ruleEngine.calculateQuizBonus(70, null);
      expect(res70.scoreBonusPx).toBe(0);
    });

    it('should calculate improvement bonus compared strictly to previous valid best score', () => {
      // Previous 62%, current 78% -> 16 points delta -> +10 PX
      const res = ruleEngine.calculateQuizBonus(78, 62);
      expect(res.improvementBonusPx).toBe(10);

      // Previous 50%, current 85% -> 35 points delta -> +40 PX
      const resHuge = ruleEngine.calculateQuizBonus(85, 50);
      expect(resHuge.improvementBonusPx).toBe(40);

      // Lower score should award 0 improvement
      const resLower = ruleEngine.calculateQuizBonus(60, 75);
      expect(resLower.improvementBonusPx).toBe(0);
    });

    it('should calculate non-stacking attendance rewards', () => {
      // 100% attendance should award +15 EX (not 5 + 10 + 15), plus 5 on-time bonus
      const resFull = ruleEngine.calculateAttendanceReward(100, true);
      expect(resFull.attendanceEx).toBe(15);
      expect(resFull.onTimeEx).toBe(5);

      // 80% attendance on time
      const res80 = ruleEngine.calculateAttendanceReward(80, false);
      expect(res80.attendanceEx).toBe(10);
      expect(res80.onTimeEx).toBe(0);
    });

    it('should calculate non-stacking project score bonus', () => {
      expect(ruleEngine.calculateProjectScoreBonus(95)).toBe(50);
      expect(ruleEngine.calculateProjectScoreBonus(85)).toBe(25);
      expect(ruleEngine.calculateProjectScoreBonus(75)).toBe(0);
    });
  });

  describe('Dual-XP Level Progression (PDF §32, §33)', () => {
    it('should not allow user to advance if Minimum Performance XP is not met', async () => {
      // Seeded levels
      const levels = [
        { id: 1, levelNumber: 1, title: 'Beginner', minimumTotalXp: 0, minimumPerformanceXp: 0 },
        { id: 2, levelNumber: 2, title: 'Explorer', minimumTotalXp: 250, minimumPerformanceXp: 50 },
        { id: 3, levelNumber: 3, title: 'Learner', minimumTotalXp: 600, minimumPerformanceXp: 150 },
        { id: 4, levelNumber: 4, title: 'Achiever', minimumTotalXp: 1200, minimumPerformanceXp: 350 },
        { id: 5, levelNumber: 5, title: 'Skilled', minimumTotalXp: 2000, minimumPerformanceXp: 600 },
        { id: 6, levelNumber: 6, title: 'Specialist', minimumTotalXp: 3500, minimumPerformanceXp: 1100 },
        { id: 7, levelNumber: 7, title: 'Expert', minimumTotalXp: 5500, minimumPerformanceXp: 1800 },
      ];
      mockPrisma.gamificationLevel.findMany.mockResolvedValue(levels);

      // Student has EX = 5,500 and PX = 500. Total = 6,000.
      // Total meets Expert (5,500), but PX is only 500 (Skilled requires 600 PX, Achiever requires 350 PX).
      // Therefore, highest qualifying level is Level 4 (Achiever)
      const wallet = {
        id: 1,
        userId: 10,
        engagementXp: 5500,
        performanceXp: 500,
        totalXp: 6000,
        currentLevelId: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const evalRes = await levelService.evaluateLevelUp(wallet as any);
      expect(evalRes.leveledUp).toBe(false); // Does not level up to Level 6 or 7!
    });

    it('should advance user when both Total XP and Minimum Performance XP are met', async () => {
      const levels = [
        { id: 1, levelNumber: 1, title: 'Beginner', minimumTotalXp: 0, minimumPerformanceXp: 0 },
        { id: 2, levelNumber: 2, title: 'Explorer', minimumTotalXp: 250, minimumPerformanceXp: 50 },
        { id: 3, levelNumber: 3, title: 'Learner', minimumTotalXp: 600, minimumPerformanceXp: 150 },
      ];
      mockPrisma.gamificationLevel.findMany.mockResolvedValue(levels);
      mockPrisma.userXpWallet.update.mockResolvedValue({});
      mockPrisma.userLevelHistory.create.mockResolvedValue({});

      const wallet = {
        id: 1,
        userId: 10,
        engagementXp: 450,
        performanceXp: 200,
        totalXp: 650,
        currentLevelId: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const evalRes = await levelService.evaluateLevelUp(wallet as any);
      expect(evalRes.leveledUp).toBe(true);
      expect(evalRes.newLevel?.title).toBe('Learner');
      expect(mockPrisma.userLevelHistory.create).toHaveBeenCalled();
    });
  });

  describe('Streak Meaningful Activity Tracking (PDF §10)', () => {
    it('should ignore non-meaningful actions (e.g. login or profile view)', async () => {
      const loginEvent = new GamificationDomainEvent({
        userId: 1,
        eventKey: 'USER_LOGGED_IN',
        sourceType: XpSourceType.SYSTEM,
      });

      const res = await streakService.processStreakActivity(loginEvent);
      expect(res.qualifyingActivity).toBe(false);
      expect(res.streakIncremented).toBe(false);
    });

    it('should increment streak on qualifying activity on a consecutive day', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      mockPrisma.userStreak.findUnique.mockResolvedValue({
        id: 1,
        userId: 1,
        currentStreak: 6,
        longestStreak: 6,
        lastQualifiedActivityDate: yesterday,
      });

      mockPrisma.userStreak.update.mockResolvedValue({
        currentStreak: 7,
        longestStreak: 7,
      });
      mockPrisma.streakHistory.upsert.mockResolvedValue({});

      const lessonEvent = new GamificationDomainEvent({
        userId: 1,
        eventKey: GamificationEventKey.LESSON_VIDEO_COMPLETED,
        sourceType: XpSourceType.LESSON,
        sourceId: 101,
      });

      const res = await streakService.processStreakActivity(lessonEvent);
      expect(res.qualifyingActivity).toBe(true);
      expect(res.streakIncremented).toBe(true);
      expect(res.currentStreak).toBe(7);
      expect(res.milestoneReached).toBe(7); // 7-day milestone!
      expect(res.milestoneBonusXp).toBe(40); // 40 EX bonus
    });
  });
});
