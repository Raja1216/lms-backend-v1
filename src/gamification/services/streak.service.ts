import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GamificationDomainEvent } from '../events/gamification.event';
import { GamificationEventKey } from '../events/gamification-event.keys';
import { XpSourceType } from '../../generated/prisma/client';

export interface StreakUpdateResult {
  qualifyingActivity: boolean;
  streakIncremented: boolean;
  currentStreak: number;
  longestStreak: number;
  milestoneReached: number | null;
  milestoneBonusXp: number;
}

const MEANINGFUL_STREAK_EVENTS = new Set<string>([
  GamificationEventKey.LESSON_VIDEO_COMPLETED,
  GamificationEventKey.LESSON_DOCUMENT_COMPLETED,
  GamificationEventKey.LESSON_ARTICLE_COMPLETED,
  GamificationEventKey.LESSON_AUDIO_COMPLETED,
  GamificationEventKey.LESSON_INTERACTIVE_COMPLETED,
  GamificationEventKey.QUIZ_PASSED_LESSON,
  GamificationEventKey.QUIZ_PASSED_CHAPTER,
  GamificationEventKey.QUIZ_PASSED_MODULE,
  GamificationEventKey.EXAM_PASSED_SUBJECT,
  GamificationEventKey.EXAM_PASSED_COURSE,
  GamificationEventKey.MOCK_TEST_COMPLETED,
  GamificationEventKey.PROJECT_SUBMITTED,
  GamificationEventKey.ASSIGNMENT_SUBMITTED,
  GamificationEventKey.LIVE_CLASS_ATTENDED,
  GamificationEventKey.LIVE_CLASS_ATTENDED_75,
  GamificationEventKey.LIVE_CLASS_ATTENDED_FULL,
]);

const STREAK_MILESTONE_REWARDS: Record<number, number> = {
  3: 15,
  7: 40,
  14: 75,
  30: 150,
  60: 300,
  100: 500,
};

@Injectable()
export class StreakService {
  private readonly logger = new Logger(StreakService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * PDF §9, §10: Evaluate whether an event qualifies as a meaningful learning action and update streak
   */
  async processStreakActivity(event: GamificationDomainEvent): Promise<StreakUpdateResult> {
    const isQualifying = MEANINGFUL_STREAK_EVENTS.has(event.eventKey);
    if (!isQualifying) {
      return {
        qualifyingActivity: false,
        streakIncremented: false,
        currentStreak: 0,
        longestStreak: 0,
        milestoneReached: null,
        milestoneBonusXp: 0,
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get or create UserStreak
    let userStreak = await this.prisma.userStreak.findUnique({
      where: { userId: event.userId },
    });

    if (!userStreak) {
      userStreak = await this.prisma.userStreak.create({
        data: {
          userId: event.userId,
          currentStreak: 0,
          longestStreak: 0,
          lastQualifiedActivityDate: null,
        },
      });
    }

    let currentStreak = userStreak.currentStreak;
    let longestStreak = userStreak.longestStreak;
    let streakIncremented = false;

    if (userStreak.lastQualifiedActivityDate) {
      const lastDate = new Date(userStreak.lastQualifiedActivityDate);
      lastDate.setHours(0, 0, 0, 0);

      const diffTime = today.getTime() - lastDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        // Activity already completed today
        return {
          qualifyingActivity: true,
          streakIncremented: false,
          currentStreak,
          longestStreak,
          milestoneReached: null,
          milestoneBonusXp: 0,
        };
      } else if (diffDays === 1) {
        // Consecutive day!
        currentStreak += 1;
        streakIncremented = true;
      } else {
        // Streak broken
        currentStreak = 1;
        streakIncremented = true;
      }
    } else {
      // First ever qualifying activity
      currentStreak = 1;
      streakIncremented = true;
    }

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }

    // Update UserStreak
    await this.prisma.userStreak.update({
      where: { id: userStreak.id },
      data: {
        currentStreak,
        longestStreak,
        lastQualifiedActivityDate: today,
      },
    });

    // Record StreakHistory (upsert to be safe)
    await this.prisma.streakHistory.upsert({
      where: {
        userId_activityDate: {
          userId: event.userId,
          activityDate: today,
        },
      },
      update: {
        qualifyingAction: event.eventKey,
        sourceId: event.sourceId,
      },
      create: {
        userId: event.userId,
        activityDate: today,
        qualifyingAction: event.eventKey,
        sourceId: event.sourceId,
      },
    });

    // Check for streak milestone reward
    const milestoneBonusXp = STREAK_MILESTONE_REWARDS[currentStreak] || 0;
    const milestoneReached = milestoneBonusXp > 0 ? currentStreak : null;

    return {
      qualifyingActivity: true,
      streakIncremented,
      currentStreak,
      longestStreak,
      milestoneReached,
      milestoneBonusXp,
    };
  }

  async getUserStreak(userId: number): Promise<{
    currentStreak: number;
    longestStreak: number;
    lastQualifiedActivityDate: Date | null;
    completedToday: boolean;
  }> {
    const streak = await this.prisma.userStreak.findUnique({
      where: { userId },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let completedToday = false;
    if (streak?.lastQualifiedActivityDate) {
      const lastDate = new Date(streak.lastQualifiedActivityDate);
      lastDate.setHours(0, 0, 0, 0);
      completedToday = lastDate.getTime() === today.getTime();
    }

    return {
      currentStreak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
      lastQualifiedActivityDate: streak?.lastQualifiedActivityDate ?? null,
      completedToday,
    };
  }
}
