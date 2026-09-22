import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GamificationDomainEvent } from '../events/gamification.event';
import { XpType, XpRepeatPolicy, GamificationXpRule } from '../../generated/prisma/client';

export interface EvaluatedXpReward {
  awarded: boolean;
  xpType: XpType;
  xpAmount: number;
  reason?: string;
  ruleId?: number;
}

@Injectable()
export class XpRuleEngineService {
  private readonly logger = new Logger(XpRuleEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluate if an event can be rewarded based on active rules, caps, and repeat policies
   */
  async evaluateReward(event: GamificationDomainEvent): Promise<EvaluatedXpReward> {
    // If the event provides an explicit override (e.g., admin manual adjustment or direct engine calculation)
    if (event.xpAmountOverride !== undefined && event.xpTypeOverride !== undefined) {
      return {
        awarded: true,
        xpType: event.xpTypeOverride,
        xpAmount: event.xpAmountOverride,
        reason: 'Explicit override grant',
      };
    }

    // Find rule for this eventKey
    const rule = await this.prisma.gamificationXpRule.findUnique({
      where: { eventKey: event.eventKey },
    });

    if (!rule || !rule.isEnabled) {
      return {
        awarded: false,
        xpType: XpType.ENGAGEMENT,
        xpAmount: 0,
        reason: `No active rule configured for eventKey: ${event.eventKey}`,
      };
    }

    // Check date ranges if configured
    const now = new Date();
    if (rule.startDate && now < rule.startDate) {
      return { awarded: false, xpType: rule.xpType, xpAmount: 0, reason: 'Rule not started yet' };
    }
    if (rule.endDate && now > rule.endDate) {
      return { awarded: false, xpType: rule.xpType, xpAmount: 0, reason: 'Rule expired' };
    }

    // Check scopes
    if (rule.courseScopeId && event.courseId && rule.courseScopeId !== event.courseId) {
      return { awarded: false, xpType: rule.xpType, xpAmount: 0, reason: 'Course scope mismatch' };
    }
    if (rule.institutionScope && event.institutionId && rule.institutionScope !== event.institutionId) {
      return { awarded: false, xpType: rule.xpType, xpAmount: 0, reason: 'Institution scope mismatch' };
    }

    // Repeat Policy evaluation
    const canRepeat = await this.checkRepeatPolicy(rule, event);
    if (!canRepeat.allowed) {
      return {
        awarded: false,
        xpType: rule.xpType,
        xpAmount: 0,
        reason: canRepeat.reason,
      };
    }

    // Calculate final XP amount (factoring in daily cap remaining)
    let finalAmount = rule.xpAmount;
    if (rule.dailyCap && rule.dailyCap > 0) {
      const todayTotal = await this.getUserTodayXpForEvent(event.userId, rule.eventKey);
      const remainingAllowed = rule.dailyCap - todayTotal;
      if (remainingAllowed <= 0) {
        return {
          awarded: false,
          xpType: rule.xpType,
          xpAmount: 0,
          reason: `Daily cap of ${rule.dailyCap} XP reached for this event`,
        };
      }
      finalAmount = Math.min(finalAmount, remainingAllowed);
    }

    return {
      awarded: true,
      xpType: rule.xpType,
      xpAmount: finalAmount,
      ruleId: rule.id,
      reason: `Rule: ${rule.ruleName}`,
    };
  }

  private async checkRepeatPolicy(
    rule: GamificationXpRule,
    event: GamificationDomainEvent,
  ): Promise<{ allowed: boolean; reason?: string }> {
    switch (rule.repeatPolicy) {
      case XpRepeatPolicy.ONCE_EVER: {
        const existing = await this.prisma.xpTransaction.findFirst({
          where: {
            userId: event.userId,
            eventKey: event.eventKey,
          },
        });
        if (existing) {
          return { allowed: false, reason: 'Awarded once per learner lifetime' };
        }
        return { allowed: true };
      }

      case XpRepeatPolicy.ONCE_PER_CONTENT: {
        if (!event.sourceId) {
          return { allowed: true };
        }
        const existing = await this.prisma.xpTransaction.findFirst({
          where: {
            userId: event.userId,
            eventKey: event.eventKey,
            sourceId: event.sourceId,
          },
        });
        if (existing) {
          return { allowed: false, reason: 'Awarded once per content item' };
        }
        return { allowed: true };
      }

      case XpRepeatPolicy.ONCE_DAILY: {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const existing = await this.prisma.xpTransaction.findFirst({
          where: {
            userId: event.userId,
            eventKey: event.eventKey,
            createdAt: { gte: startOfDay },
          },
        });
        if (existing) {
          return { allowed: false, reason: 'Already awarded today' };
        }
        return { allowed: true };
      }

      case XpRepeatPolicy.UNLIMITED_WITH_DAILY_CAP:
      default:
        return { allowed: true };
    }
  }

  private async getUserTodayXpForEvent(userId: number, eventKey: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const transactions = await this.prisma.xpTransaction.findMany({
      where: {
        userId,
        eventKey,
        createdAt: { gte: startOfDay },
      },
      select: { xpAmount: true },
    });

    return transactions.reduce((sum, tx) => sum + tx.xpAmount, 0);
  }

  /**
   * PDF §6.2 & §6.3: Calculate non-stacking score bonuses and improvement for Quizzes
   */
  calculateQuizBonus(scorePercent: number, previousBestScore: number | null): {
    scoreBonusPx: number;
    improvementBonusPx: number;
  } {
    // Non-stacking highest score bonus: 100% (+75 PX), 90-99.99% (+40 PX), 80-89.99% (+20 PX)
    let scoreBonusPx = 0;
    if (scorePercent >= 100) {
      scoreBonusPx = 75;
    } else if (scorePercent >= 90) {
      scoreBonusPx = 40;
    } else if (scorePercent >= 80) {
      scoreBonusPx = 20;
    }

    // Improvement Rule: only compare against learner's previous valid best score
    let improvementBonusPx = 0;
    if (previousBestScore !== null && scorePercent > previousBestScore) {
      const delta = scorePercent - previousBestScore;
      if (delta >= 30) {
        improvementBonusPx = 40;
      } else if (delta >= 20) {
        improvementBonusPx = 20;
      } else if (delta >= 10) {
        improvementBonusPx = 10;
      } else if (delta >= 5) {
        improvementBonusPx = 5;
      }
    }

    return { scoreBonusPx, improvementBonusPx };
  }

  /**
   * PDF §8.1: Attendance rewards: highest reward used (not stacking: e.g. 100% gets 15 EX, not 5+10+15)
   */
  calculateAttendanceReward(percentAttended: number, onTime: boolean): { attendanceEx: number; onTimeEx: number } {
    let attendanceEx = 5; // attended live class
    if (percentAttended >= 100) {
      attendanceEx = 15;
    } else if (percentAttended >= 75) {
      attendanceEx = 10;
    }

    const onTimeEx = onTime ? 5 : 0;
    return { attendanceEx, onTimeEx };
  }

  /**
   * PDF §7.2: Project score bonus (non-stacking: 90%+ gives +50 PX, 80-89.99% gives +25 PX)
   */
  calculateProjectScoreBonus(scorePercent: number): number {
    if (scorePercent >= 90) {
      return 50;
    }
    if (scorePercent >= 80) {
      return 25;
    }
    return 0;
  }
}
