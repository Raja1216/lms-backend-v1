import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Badge, XpSourceType } from '../../generated/prisma/client';

export interface EvaluatedBadgeAward {
  badge: Badge;
  isNew: boolean;
}

@Injectable()
export class BadgeService {
  private readonly logger = new Logger(BadgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Award a badge to a user if not already earned
   */
  async awardBadgeBySlug(
    userId: number,
    badgeSlug: string,
    sourceType: XpSourceType = XpSourceType.SYSTEM,
    sourceId?: string,
  ): Promise<EvaluatedBadgeAward | null> {
    const badge = await this.prisma.badge.findUnique({
      where: { slug: badgeSlug },
    });

    if (!badge || !badge.isActive) {
      return null;
    }

    const existing = await this.prisma.userBadge.findUnique({
      where: {
        userId_badgeId: {
          userId,
          badgeId: badge.id,
        },
      },
    });

    if (existing) {
      return { badge, isNew: false };
    }

    await this.prisma.userBadge.create({
      data: {
        userId,
        badgeId: badge.id,
        sourceType,
        sourceId,
      },
    });

    this.logger.log(`Awarded badge ${badge.name} (${badge.slug}) to user ${userId}`);
    return { badge, isNew: true };
  }

  /**
   * Evaluates if any badges should be awarded after an event
   */
  async checkAndAwardBadges(
    userId: number,
    eventKey: string,
    sourceType: XpSourceType,
    sourceId?: string,
  ): Promise<Badge[]> {
    const newlyAwarded: Badge[] = [];

    // Streak badge triggers
    if (eventKey === 'STREAK_3_DAYS') {
      const res = await this.awardBadgeBySlug(userId, 'getting-started', sourceType, sourceId);
      if (res?.isNew) newlyAwarded.push(res.badge);
    } else if (eventKey === 'STREAK_7_DAYS') {
      const res = await this.awardBadgeBySlug(userId, 'weekly-warrior', sourceType, sourceId);
      if (res?.isNew) newlyAwarded.push(res.badge);
    } else if (eventKey === 'STREAK_14_DAYS') {
      const res = await this.awardBadgeBySlug(userId, 'consistency-builder', sourceType, sourceId);
      if (res?.isNew) newlyAwarded.push(res.badge);
    } else if (eventKey === 'STREAK_30_DAYS') {
      const res = await this.awardBadgeBySlug(userId, 'consistent-learner', sourceType, sourceId);
      if (res?.isNew) newlyAwarded.push(res.badge);
    } else if (eventKey === 'STREAK_60_DAYS') {
      const res = await this.awardBadgeBySlug(userId, 'determined-learner', sourceType, sourceId);
      if (res?.isNew) newlyAwarded.push(res.badge);
    } else if (eventKey === 'STREAK_100_DAYS') {
      const res = await this.awardBadgeBySlug(userId, 'unstoppable', sourceType, sourceId);
      if (res?.isNew) newlyAwarded.push(res.badge);
    }

    // Quiz score 100%
    if (eventKey === 'QUIZ_SCORE_100') {
      const res = await this.awardBadgeBySlug(userId, 'perfect-score', sourceType, sourceId);
      if (res?.isNew) newlyAwarded.push(res.badge);
    }

    // First course / lesson
    if (eventKey === 'LESSON_VIDEO_COMPLETED' || eventKey === 'LESSON_DOCUMENT_COMPLETED') {
      const res = await this.awardBadgeBySlug(userId, 'first-step', sourceType, sourceId);
      if (res?.isNew) newlyAwarded.push(res.badge);
    }

    if (eventKey === 'COURSE_COMPLETED') {
      const res = await this.awardBadgeBySlug(userId, 'course-finisher', sourceType, sourceId);
      if (res?.isNew) newlyAwarded.push(res.badge);
    }

    // Certificate
    if (eventKey === 'CERTIFICATE_FIRST') {
      const res = await this.awardBadgeBySlug(userId, 'certified-learner', sourceType, sourceId);
      if (res?.isNew) newlyAwarded.push(res.badge);
    }

    return newlyAwarded;
  }

  /**
   * Fetch all badges for a user with earned status
   */
  async getUserBadgesWithCatalog(userId: number) {
    const allBadges = await this.prisma.badge.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { rarity: 'asc' }],
    });

    const userBadges = await this.prisma.userBadge.findMany({
      where: { userId },
    });

    const earnedMap = new Map(userBadges.map((ub) => [ub.badgeId, ub]));

    return allBadges.map((badge) => {
      const earned = earnedMap.get(badge.id);
      return {
        ...badge,
        isEarned: !!earned,
        earnedAt: earned?.earnedAt || null,
      };
    });
  }
}
