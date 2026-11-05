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
  freezeUsed?: boolean;
  freezeTokensRemaining?: number;
}

export interface UserStreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastQualifiedActivityDate: Date | null;
  completedToday: boolean;
  freezeTokensAvailable: number;
  isFrozen?: boolean;
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

/**
 * Normalizes any Date or date string to a UTC midnight Date (00:00:00.000Z)
 * corresponding to the calendar date (YYYY-MM-DD).
 * Avoids local timezone shift bugs when storing or reading @db.Date from MySQL.
 */
export function toCalendarUtcDate(date: Date | string = new Date()): Date {
  if (typeof date === 'string') {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, y, m, d] = match;
      return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    }
  }

  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date provided to toCalendarUtcDate: ${date}`);
  }

  // When Prisma retrieves a MySQL @db.Date, it parses it as UTC midnight (00:00:00.000Z).
  // In that case, extract UTC calendar parts to avoid shifting.
  if (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  ) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  // Otherwise (e.g. `new Date()` in local time), extract local calendar parts:
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/**
 * Calculates the calendar day difference between two dates.
 * e.g., today (Nov 4) - yesterday (Nov 3) = 1 day.
 */
export function getCalendarDayDifference(fromDate: Date | string, toDate: Date | string): number {
  const fromUtc = toCalendarUtcDate(fromDate);
  const toUtc = toCalendarUtcDate(toDate);
  const MS_PER_DAY = 86_400_000; // 24 * 60 * 60 * 1000
  return Math.round((toUtc.getTime() - fromUtc.getTime()) / MS_PER_DAY);
}

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
        freezeUsed: false,
        freezeTokensRemaining: 0,
      };
    }

    const today = toCalendarUtcDate(new Date());

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
          freezeTokensAvailable: 0,
        },
      });
    }

    let currentStreak = userStreak.currentStreak;
    let longestStreak = userStreak.longestStreak;
    let freezeTokens = userStreak.freezeTokensAvailable ?? 0;
    let streakIncremented = false;
    let freezeUsed = false;

    if (userStreak.lastQualifiedActivityDate) {
      const diffDays = getCalendarDayDifference(userStreak.lastQualifiedActivityDate, today);

      if (diffDays <= 0) {
        // Activity already completed today
        return {
          qualifyingActivity: true,
          streakIncremented: false,
          currentStreak,
          longestStreak,
          milestoneReached: null,
          milestoneBonusXp: 0,
          freezeUsed: false,
          freezeTokensRemaining: freezeTokens,
        };
      } else if (diffDays === 1) {
        // Consecutive day!
        currentStreak += 1;
        streakIncremented = true;
      } else {
        // diffDays >= 2: Missed one or more days
        const missedDays = diffDays - 1;

        if (freezeTokens >= missedDays) {
          // Streak preserved by freeze token(s)!
          freezeTokens -= missedDays;
          currentStreak += 1; // streak continues!
          streakIncremented = true;
          freezeUsed = true;
          this.logger.log(
            `User ${event.userId} consumed ${missedDays} freeze token(s). Streak preserved at ${currentStreak} days. Remaining tokens: ${freezeTokens}`,
          );

          // Record freeze token usage in StreakHistory for each missed day
          for (let i = 1; i <= missedDays; i++) {
            const missedDate = toCalendarUtcDate(userStreak.lastQualifiedActivityDate);
            missedDate.setUTCDate(missedDate.getUTCDate() + i);

            await this.prisma.streakHistory.upsert({
              where: {
                userId_activityDate: {
                  userId: event.userId,
                  activityDate: missedDate,
                },
              },
              update: {
                qualifyingAction: 'STREAK_FREEZE_CONSUMED',
                sourceId: 'FREEZE_TOKEN',
              },
              create: {
                userId: event.userId,
                activityDate: missedDate,
                qualifyingAction: 'STREAK_FREEZE_CONSUMED',
                sourceId: 'FREEZE_TOKEN',
              },
            });
          }
        } else {
          // Not enough freeze tokens: streak broken, reset to 1
          currentStreak = 1;
          streakIncremented = true;
        }
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
        freezeTokensAvailable: freezeTokens,
      },
    });

    // Record StreakHistory for today (upsert to be safe)
    await this.prisma.streakHistory.upsert({
      where: {
        userId_activityDate: {
          userId: event.userId,
          activityDate: today,
        },
      },
      update: {
        qualifyingAction: event.eventKey,
        sourceId: event.sourceId ? String(event.sourceId) : null,
      },
      create: {
        userId: event.userId,
        activityDate: today,
        qualifyingAction: event.eventKey,
        sourceId: event.sourceId ? String(event.sourceId) : null,
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
      freezeUsed,
      freezeTokensRemaining: freezeTokens,
    };
  }

  /**
   * Accurately fetch user streak status (evaluates broken streaks and active freezes on read)
   */
  async getUserStreak(userId: number): Promise<UserStreakInfo> {
    const streak = await this.prisma.userStreak.findUnique({
      where: { userId },
    });

    if (!streak) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastQualifiedActivityDate: null,
        completedToday: false,
        freezeTokensAvailable: 0,
        isFrozen: false,
      };
    }

    const today = toCalendarUtcDate(new Date());
    let currentStreak = streak.currentStreak;
    let completedToday = false;
    let isFrozen = false;

    if (streak.lastQualifiedActivityDate) {
      const diffDays = getCalendarDayDifference(streak.lastQualifiedActivityDate, today);

      if (diffDays <= 0) {
        // Activity completed today
        completedToday = true;
      } else if (diffDays === 1) {
        // Activity completed yesterday; today is pending (streak is alive!)
        completedToday = false;
      } else {
        // Missed at least 1 day (diffDays >= 2)
        const missedDays = diffDays - 1;
        const availableTokens = streak.freezeTokensAvailable ?? 0;

        if (availableTokens >= missedDays) {
          // Protected by available freeze tokens for today!
          completedToday = false;
          isFrozen = true;
        } else {
          // Broken streak! User has been inactive and does not have enough freeze tokens
          currentStreak = 0;
          completedToday = false;

          // If the DB still has a stale currentStreak > 0, proactively reset it in DB
          if (streak.currentStreak > 0) {
            await this.prisma.userStreak
              .update({
                where: { id: streak.id },
                data: { currentStreak: 0 },
              })
              .catch((err) => {
                this.logger.warn(`Failed to reset broken streak for user ${userId}: ${err.message}`);
              });
          }
        }
      }
    }

    return {
      currentStreak,
      longestStreak: streak.longestStreak,
      lastQualifiedActivityDate: streak.lastQualifiedActivityDate,
      completedToday,
      freezeTokensAvailable: streak.freezeTokensAvailable ?? 0,
      isFrozen,
    };
  }

  /**
   * Add / grant streak freeze tokens to a user's account
   */
  async addFreezeTokens(userId: number, count: number): Promise<{ freezeTokensAvailable: number }> {
    const validCount = Math.max(1, count || 1);

    const updated = await this.prisma.userStreak.upsert({
      where: { userId },
      update: {
        freezeTokensAvailable: { increment: validCount },
      },
      create: {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        freezeTokensAvailable: validCount,
      },
    });

    return { freezeTokensAvailable: updated.freezeTokensAvailable };
  }
}
