import { Test, TestingModule } from '@nestjs/testing';
import {
  StreakService,
  toCalendarUtcDate,
  getCalendarDayDifference,
} from './streak.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GamificationDomainEvent } from '../events/gamification.event';
import { GamificationEventKey } from '../events/gamification-event.keys';
import { XpSourceType } from '../../generated/prisma/client';

describe('StreakService', () => {
  let service: StreakService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      userStreak: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      streakHistory: {
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<StreakService>(StreakService);
  });

  describe('Timezone & Calendar Date Helpers', () => {
    it('should normalize string date to UTC midnight', () => {
      const d = toCalendarUtcDate('2026-11-04');
      expect(d.toISOString()).toBe('2026-11-04T00:00:00.000Z');
    });

    it('should preserve UTC midnight date without local hour shifting', () => {
      const d = toCalendarUtcDate(new Date('2026-11-04T00:00:00.000Z'));
      expect(d.toISOString()).toBe('2026-11-04T00:00:00.000Z');
    });

    it('should calculate calendar day difference accurately', () => {
      const day1 = '2026-11-01';
      const day2 = '2026-11-04';
      expect(getCalendarDayDifference(day1, day2)).toBe(3);
      expect(getCalendarDayDifference(day2, day1)).toBe(-3);
      expect(getCalendarDayDifference(day1, day1)).toBe(0);
    });
  });

  describe('processStreakActivity', () => {
    it('should reject non-qualifying activities', async () => {
      const event = new GamificationDomainEvent({
        userId: 1,
        eventKey: 'USER_LOGGED_IN',
        sourceType: XpSourceType.SYSTEM,
      });

      const res = await service.processStreakActivity(event);
      expect(res.qualifyingActivity).toBe(false);
      expect(res.streakIncremented).toBe(false);
    });

    it('should initialize streak to 1 on first ever activity', async () => {
      mockPrisma.userStreak.findUnique.mockResolvedValue(null);
      mockPrisma.userStreak.create.mockResolvedValue({
        id: 1,
        userId: 1,
        currentStreak: 0,
        longestStreak: 0,
        lastQualifiedActivityDate: null,
        freezeTokensAvailable: 0,
      });
      mockPrisma.userStreak.update.mockResolvedValue({});
      mockPrisma.streakHistory.upsert.mockResolvedValue({});

      const event = new GamificationDomainEvent({
        userId: 1,
        eventKey: GamificationEventKey.LESSON_VIDEO_COMPLETED,
        sourceType: XpSourceType.LESSON,
        sourceId: 101,
      });

      const res = await service.processStreakActivity(event);
      expect(res.qualifyingActivity).toBe(true);
      expect(res.streakIncremented).toBe(true);
      expect(res.currentStreak).toBe(1);
      expect(res.longestStreak).toBe(1);
    });

    it('should not increment if activity already completed today', async () => {
      const today = toCalendarUtcDate(new Date());

      mockPrisma.userStreak.findUnique.mockResolvedValue({
        id: 1,
        userId: 1,
        currentStreak: 4,
        longestStreak: 4,
        lastQualifiedActivityDate: today,
        freezeTokensAvailable: 0,
      });

      const event = new GamificationDomainEvent({
        userId: 1,
        eventKey: GamificationEventKey.QUIZ_PASSED_LESSON,
        sourceType: XpSourceType.QUIZ,
        sourceId: 202,
      });

      const res = await service.processStreakActivity(event);
      expect(res.qualifyingActivity).toBe(true);
      expect(res.streakIncremented).toBe(false);
      expect(res.currentStreak).toBe(4);
      expect(mockPrisma.userStreak.update).not.toHaveBeenCalled();
    });

    it('should increment streak on consecutive day activity', async () => {
      const yesterday = toCalendarUtcDate(new Date());
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);

      mockPrisma.userStreak.findUnique.mockResolvedValue({
        id: 1,
        userId: 1,
        currentStreak: 6,
        longestStreak: 6,
        lastQualifiedActivityDate: yesterday,
        freezeTokensAvailable: 0,
      });
      mockPrisma.userStreak.update.mockResolvedValue({});
      mockPrisma.streakHistory.upsert.mockResolvedValue({});

      const event = new GamificationDomainEvent({
        userId: 1,
        eventKey: GamificationEventKey.LESSON_VIDEO_COMPLETED,
        sourceType: XpSourceType.LESSON,
        sourceId: 101,
      });

      const res = await service.processStreakActivity(event);
      expect(res.qualifyingActivity).toBe(true);
      expect(res.streakIncremented).toBe(true);
      expect(res.currentStreak).toBe(7);
      expect(res.milestoneReached).toBe(7);
      expect(res.milestoneBonusXp).toBe(40);
    });

    it('should reset streak to 1 if broken without freeze tokens', async () => {
      const threeDaysAgo = toCalendarUtcDate(new Date());
      threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);

      mockPrisma.userStreak.findUnique.mockResolvedValue({
        id: 1,
        userId: 1,
        currentStreak: 10,
        longestStreak: 10,
        lastQualifiedActivityDate: threeDaysAgo,
        freezeTokensAvailable: 0,
      });
      mockPrisma.userStreak.update.mockResolvedValue({});
      mockPrisma.streakHistory.upsert.mockResolvedValue({});

      const event = new GamificationDomainEvent({
        userId: 1,
        eventKey: GamificationEventKey.LESSON_VIDEO_COMPLETED,
        sourceType: XpSourceType.LESSON,
        sourceId: 101,
      });

      const res = await service.processStreakActivity(event);
      expect(res.qualifyingActivity).toBe(true);
      expect(res.streakIncremented).toBe(true);
      expect(res.currentStreak).toBe(1);
      expect(res.longestStreak).toBe(10); // longest streak preserved
      expect(res.freezeUsed).toBe(false);
    });

    it('should use freeze token to preserve streak when 1 day was missed', async () => {
      // Missed yesterday: diffDays = 2 (missedDays = 1)
      const twoDaysAgo = toCalendarUtcDate(new Date());
      twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);

      mockPrisma.userStreak.findUnique.mockResolvedValue({
        id: 1,
        userId: 1,
        currentStreak: 5,
        longestStreak: 5,
        lastQualifiedActivityDate: twoDaysAgo,
        freezeTokensAvailable: 1,
      });
      mockPrisma.userStreak.update.mockResolvedValue({});
      mockPrisma.streakHistory.upsert.mockResolvedValue({});

      const event = new GamificationDomainEvent({
        userId: 1,
        eventKey: GamificationEventKey.LESSON_VIDEO_COMPLETED,
        sourceType: XpSourceType.LESSON,
        sourceId: 101,
      });

      const res = await service.processStreakActivity(event);
      expect(res.qualifyingActivity).toBe(true);
      expect(res.streakIncremented).toBe(true);
      expect(res.currentStreak).toBe(6); // preserved and continued!
      expect(res.freezeUsed).toBe(true);
      expect(res.freezeTokensRemaining).toBe(0);

      // Verify streak history was recorded for the freeze day
      expect(mockPrisma.streakHistory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            qualifyingAction: 'STREAK_FREEZE_CONSUMED',
          }),
        }),
      );
    });
  });

  describe('getUserStreak (Read Accuracy)', () => {
    it('should return 0 currentStreak if user was inactive for multiple days without freeze tokens', async () => {
      const fourDaysAgo = toCalendarUtcDate(new Date());
      fourDaysAgo.setUTCDate(fourDaysAgo.getUTCDate() - 4);

      mockPrisma.userStreak.findUnique.mockResolvedValue({
        id: 1,
        userId: 1,
        currentStreak: 12, // Stale value in DB
        longestStreak: 12,
        lastQualifiedActivityDate: fourDaysAgo,
        freezeTokensAvailable: 0,
      });
      mockPrisma.userStreak.update.mockResolvedValue({});

      const res = await service.getUserStreak(1);
      expect(res.currentStreak).toBe(0); // Accurately returns 0, NOT stale 12!
      expect(res.longestStreak).toBe(12);
      expect(res.completedToday).toBe(false);
      expect(res.isFrozen).toBe(false);

      // Proactively corrected the stale DB row
      expect(mockPrisma.userStreak.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { currentStreak: 0 },
      });
    });

    it('should keep streak alive if active yesterday (today pending)', async () => {
      const yesterday = toCalendarUtcDate(new Date());
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);

      mockPrisma.userStreak.findUnique.mockResolvedValue({
        id: 1,
        userId: 1,
        currentStreak: 8,
        longestStreak: 8,
        lastQualifiedActivityDate: yesterday,
        freezeTokensAvailable: 0,
      });

      const res = await service.getUserStreak(1);
      expect(res.currentStreak).toBe(8);
      expect(res.completedToday).toBe(false);
      expect(res.isFrozen).toBe(false);
      expect(mockPrisma.userStreak.update).not.toHaveBeenCalled();
    });

    it('should indicate completedToday if active today', async () => {
      const today = toCalendarUtcDate(new Date());

      mockPrisma.userStreak.findUnique.mockResolvedValue({
        id: 1,
        userId: 1,
        currentStreak: 8,
        longestStreak: 8,
        lastQualifiedActivityDate: today,
        freezeTokensAvailable: 0,
      });

      const res = await service.getUserStreak(1);
      expect(res.currentStreak).toBe(8);
      expect(res.completedToday).toBe(true);
      expect(res.isFrozen).toBe(false);
    });

    it('should mark as isFrozen if protected by available freeze token', async () => {
      const twoDaysAgo = toCalendarUtcDate(new Date());
      twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);

      mockPrisma.userStreak.findUnique.mockResolvedValue({
        id: 1,
        userId: 1,
        currentStreak: 8,
        longestStreak: 8,
        lastQualifiedActivityDate: twoDaysAgo,
        freezeTokensAvailable: 1,
      });

      const res = await service.getUserStreak(1);
      expect(res.currentStreak).toBe(8); // Protected!
      expect(res.completedToday).toBe(false);
      expect(res.isFrozen).toBe(true);
      expect(mockPrisma.userStreak.update).not.toHaveBeenCalled();
    });
  });

  describe('addFreezeTokens', () => {
    it('should increment freeze tokens', async () => {
      mockPrisma.userStreak.upsert.mockResolvedValue({
        freezeTokensAvailable: 3,
      });

      const res = await service.addFreezeTokens(1, 2);
      expect(res.freezeTokensAvailable).toBe(3);
      expect(mockPrisma.userStreak.upsert).toHaveBeenCalledWith({
        where: { userId: 1 },
        update: {
          freezeTokensAvailable: { increment: 2 },
        },
        create: {
          userId: 1,
          currentStreak: 0,
          longestStreak: 0,
          freezeTokensAvailable: 2,
        },
      });
    });
  });
});

