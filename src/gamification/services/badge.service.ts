import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Badge, XpSourceType } from '../../generated/prisma/client';

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../generated/prisma/client';

import { CreateBadgeDto } from '../dto/create-badge.dto';
import { UpdateBadgeDto } from '../dto/update-badge.dto';
import { ListBadgeDto } from '../dto/list-badge.dto';

export interface EvaluatedBadgeAward {
  badge: Badge;
  isNew: boolean;
}

@Injectable()
export class BadgeService {
  private readonly logger = new Logger(BadgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Convert Prisma Badge into the frontend API structure.
   */
  private formatBadge(badge: Badge) {
    return {
      id: badge.id,
      type: badge.category,
      title: badge.name,
      shortDescription: badge.shortDescription,
      description: badge.description,
      imageUrl: badge.icon,
      background: badge.background,
      trigger: badge.conditionType,
      targetScope: badge.targetScope,
      targetId: badge.targetId,
      targetLabel: badge.targetLabel,
      targetPath: badge.targetPath,
      threshold: badge.threshold,
      xpReward: badge.xpRewardEngagement,
      isActive: badge.isActive,
      createdAt: badge.createdAt,
      updatedAt: badge.updatedAt,
    };
  }

  /**
   * Generate a unique badge slug.
   * The suffix avoids duplicate titles causing collisions.
   */
  private generateBadgeSlug(title: string): string {
    const base =
      title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80) || 'badge';

    return `${base}-${randomUUID().slice(0, 8)}`;
  }

  /**
   * Map incoming frontend fields to existing Prisma fields.
   */
  private mapBadgeInput(
    dto: Partial<CreateBadgeDto>,
  ): Prisma.BadgeUncheckedUpdateInput {
    const data: Prisma.BadgeUncheckedUpdateInput = {};

    if (dto.type !== undefined) data.category = dto.type;
    if (dto.title !== undefined) data.name = dto.title;

    if (dto.shortDescription !== undefined)
      data.shortDescription = dto.shortDescription;

    if (dto.description !== undefined) data.description = dto.description;

    if (dto.imageUrl !== undefined) data.icon = dto.imageUrl;

    if (dto.background !== undefined) data.background = dto.background;

    if (dto.trigger !== undefined) data.conditionType = dto.trigger;

    if (dto.targetScope !== undefined) data.targetScope = dto.targetScope;

    if (dto.targetId !== undefined) data.targetId = dto.targetId;

    if (dto.targetLabel !== undefined) data.targetLabel = dto.targetLabel;

    if (dto.targetPath !== undefined) {
      data.targetPath =
        dto.targetPath === null
          ? Prisma.DbNull
          : (dto.targetPath as Prisma.InputJsonObject);
    }

    if (dto.threshold !== undefined) data.threshold = dto.threshold;

    if (dto.xpReward !== undefined) data.xpRewardEngagement = dto.xpReward;

    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return data;
  }

  /**
   * Validate basic target configuration.
   */
  private validateBadgeTarget(dto: Partial<CreateBadgeDto>) {
    const scope = dto.targetScope;

    if (scope !== undefined && !['ALL', 'SPECIFIC'].includes(scope)) {
      throw new BadRequestException('targetScope must be ALL or SPECIFIC');
    }

    if (scope === 'SPECIFIC' && !dto.targetId) {
      throw new BadRequestException(
        'targetId is required for SPECIFIC targetScope',
      );
    }

    if (
      dto.threshold !== undefined &&
      dto.threshold !== null &&
      dto.threshold < 1
    ) {
      throw new BadRequestException('threshold must be at least 1');
    }
  }

  /**
   * GET /badge
   */
  async listBadgesAdmin(query: ListBadgeDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.BadgeWhereInput = {};

    if (query.type) {
      where.category = query.type;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const search = query.search?.trim();

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { shortDescription: { contains: search } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.badge.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.badge.count({ where }),
    ]);

    return {
      items: items.map((badge) => this.formatBadge(badge)),
      total,
      page,
      limit,
    };
  }

  /**
   * GET /badge/:id
   */
  async getBadgeById(id: number) {
    const badge = await this.prisma.badge.findUnique({
      where: { id },
    });

    if (!badge) {
      throw new NotFoundException('Badge not found');
    }

    return this.formatBadge(badge);
  }

  /**
   * POST /badge
   */
  async createBadgeAdmin(dto: CreateBadgeDto) {
    this.validateBadgeTarget(dto);

    const data = this.mapBadgeInput(dto);

    const badge = await this.prisma.badge.create({
      data: {
        name: dto.title,
        slug: this.generateBadgeSlug(dto.title),
        description: dto.description,
        icon: dto.imageUrl,
        category: dto.type,
        conditionType: dto.trigger,
        targetScope: dto.targetScope,
        shortDescription: dto.shortDescription,
        background: dto.background,
        targetId: dto.targetId,
        targetLabel: dto.targetLabel,
        targetPath:
          dto.targetPath === null
            ? Prisma.DbNull
            : dto.targetPath === undefined
              ? undefined
              : (dto.targetPath as Prisma.InputJsonObject),
        threshold: dto.threshold,
        xpRewardEngagement: dto.xpReward ?? 0,
        xpRewardPerformance: 0,
        isActive: dto.isActive ?? true,
      },
    });

    return this.formatBadge(badge);
  }

  /**
   * PATCH /badge/:id
   */
  async updateBadgeAdmin(id: number, dto: UpdateBadgeDto) {
    const existing = await this.prisma.badge.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Badge not found');
    }

    this.validateBadgeTarget({
      targetScope: dto.targetScope ?? existing.targetScope,
      targetId: dto.targetId !== undefined ? dto.targetId : existing.targetId,
      threshold:
        dto.threshold !== undefined ? dto.threshold : existing.threshold,
    });

    const badge = await this.prisma.badge.update({
      where: { id },
      data: this.mapBadgeInput(dto),
    });

    return this.formatBadge(badge);
  }

  /**
   * DELETE /badge/:id
   *
   * Avoid deleting a badge already earned by students
   * or linked to an achievement.
   */
  async deleteBadgeAdmin(id: number) {
    const badge = await this.prisma.badge.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!badge) {
      throw new NotFoundException('Badge not found');
    }

    const [awardedCount, achievementCount] = await this.prisma.$transaction([
      this.prisma.userBadge.count({
        where: { badgeId: id },
      }),
      this.prisma.achievement.count({
        where: { badgeId: id },
      }),
    ]);

    if (awardedCount > 0 || achievementCount > 0) {
      throw new ConflictException(
        'Badge is already in use. Deactivate it instead.',
      );
    }

    await this.prisma.badge.delete({
      where: { id },
    });

    return { message: 'Badge deleted' };
  }

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

    this.logger.log(
      `Awarded badge ${badge.name} (${badge.slug}) to user ${userId}`,
    );
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
      const res = await this.awardBadgeBySlug(
        userId,
        'getting-started',
        sourceType,
        sourceId,
      );
      if (res?.isNew) newlyAwarded.push(res.badge);
    } else if (eventKey === 'STREAK_7_DAYS') {
      const res = await this.awardBadgeBySlug(
        userId,
        'weekly-warrior',
        sourceType,
        sourceId,
      );
      if (res?.isNew) newlyAwarded.push(res.badge);
    } else if (eventKey === 'STREAK_14_DAYS') {
      const res = await this.awardBadgeBySlug(
        userId,
        'consistency-builder',
        sourceType,
        sourceId,
      );
      if (res?.isNew) newlyAwarded.push(res.badge);
    } else if (eventKey === 'STREAK_30_DAYS') {
      const res = await this.awardBadgeBySlug(
        userId,
        'consistent-learner',
        sourceType,
        sourceId,
      );
      if (res?.isNew) newlyAwarded.push(res.badge);
    } else if (eventKey === 'STREAK_60_DAYS') {
      const res = await this.awardBadgeBySlug(
        userId,
        'determined-learner',
        sourceType,
        sourceId,
      );
      if (res?.isNew) newlyAwarded.push(res.badge);
    } else if (eventKey === 'STREAK_100_DAYS') {
      const res = await this.awardBadgeBySlug(
        userId,
        'unstoppable',
        sourceType,
        sourceId,
      );
      if (res?.isNew) newlyAwarded.push(res.badge);
    }

    // Quiz score 100%
    if (eventKey === 'QUIZ_SCORE_100') {
      const res = await this.awardBadgeBySlug(
        userId,
        'perfect-score',
        sourceType,
        sourceId,
      );
      if (res?.isNew) newlyAwarded.push(res.badge);
    }

    // First course / lesson
    if (
      eventKey === 'LESSON_VIDEO_COMPLETED' ||
      eventKey === 'LESSON_DOCUMENT_COMPLETED'
    ) {
      const res = await this.awardBadgeBySlug(
        userId,
        'first-step',
        sourceType,
        sourceId,
      );
      if (res?.isNew) newlyAwarded.push(res.badge);
    }

    if (eventKey === 'COURSE_COMPLETED') {
      const res = await this.awardBadgeBySlug(
        userId,
        'course-finisher',
        sourceType,
        sourceId,
      );
      if (res?.isNew) newlyAwarded.push(res.badge);
    }

    // Certificate
    if (eventKey === 'CERTIFICATE_FIRST') {
      const res = await this.awardBadgeBySlug(
        userId,
        'certified-learner',
        sourceType,
        sourceId,
      );
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
