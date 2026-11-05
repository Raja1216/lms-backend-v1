import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  Badge,
  XpSourceType,
  BadgeTargetScope,
  BadgeCategory,
} from '../../generated/prisma/client';
import { createPagedResponse } from '../../shared/create-paged-response';

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

export interface TargetHierarchyResult {
  trigger: string;
  targetId: string;
  targetLabel: string;
  course?: { id: number; title: string } | null;
  subject?: { id: number; title: string; name?: string } | null;
  module?: { id: number; title: string } | null;
  chapter?: { id: number; title: string } | null;
  lesson?: { id: number; title: string } | null;
  quiz?: { id: number; title: string } | null;
  targetPath: Record<string, string>;
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

    if (dto.imageUrl !== undefined) data.icon = dto.imageUrl ?? '';

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

    if (
      scope !== undefined &&
      !Object.values(BadgeTargetScope).includes(scope)
    ) {
      throw new BadRequestException('targetScope must be ALL or SPECIFIC');
    }

    if (scope === BadgeTargetScope.SPECIFIC && !dto.targetId) {
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
    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const limit = Number(query.limit) > 0 ? Number(query.limit) : 10;
    const skip = (page - 1) * limit;

    const where: Prisma.BadgeWhereInput = {};

    if (query.type && query.type !== 'ALL') {
      const typeUpper = query.type.toUpperCase();
      if (typeUpper === 'ENGAGEMENT') {
        where.category = {
          in: [
            BadgeCategory.STREAK,
            BadgeCategory.COMMUNITY,
            BadgeCategory.ATTENDANCE,
          ],
        };
      } else if (typeUpper === 'LEARNING') {
        where.category = {
          in: [
            BadgeCategory.LEARNING,
            BadgeCategory.QUIZ,
            BadgeCategory.PROJECT,
            BadgeCategory.CERTIFICATE,
            BadgeCategory.DOMAIN,
          ],
        };
      } else if (
        Object.values(BadgeCategory).includes(typeUpper as BadgeCategory)
      ) {
        where.category = typeUpper as BadgeCategory;
      }
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const searchKeyword = (query.keyword || query.search || '').trim();
    if (searchKeyword) {
      where.OR = [
        { name: { contains: searchKeyword } },
        { description: { contains: searchKeyword } },
        { shortDescription: { contains: searchKeyword } },
        { conditionType: { contains: searchKeyword } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.badge.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.badge.count({ where }),
    ]);

    const formatted = items.map((badge) => this.formatBadge(badge));
    return createPagedResponse(formatted, page, limit, total);
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

    const badge = await this.prisma.badge.create({
      data: {
        name: dto.title,
        slug: this.generateBadgeSlug(dto.title),
        description: dto.description,
        icon: dto.imageUrl ?? '',
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

  /**
   * 1. Target hierarchy for Course trigger (COURSE_COMPLETE)
   */
  async getCourseTargetHierarchy(id: number): Promise<TargetHierarchyResult> {
    const course = await this.prisma.course.findUnique({
      where: { id },
      select: { id: true, title: true },
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    return {
      trigger: 'COURSE_COMPLETE',
      targetId: String(course.id),
      targetLabel: course.title,
      course: { id: course.id, title: course.title },
      targetPath: {
        course: String(course.id),
      },
    };
  }

  /**
   * 2. Target hierarchy for Subject trigger (SUBJECT_COMPLETE)
   */
  async getSubjectTargetHierarchy(id: number): Promise<TargetHierarchyResult> {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        courses: {
          select: {
            course: { select: { id: true, title: true } },
          },
          take: 1,
        },
      },
    });
    if (!subject) {
      throw new NotFoundException(`Subject with ID ${id} not found`);
    }

    const course = subject.courses[0]?.course ?? null;
    const targetPath: Record<string, string> = {};
    if (course) targetPath.course = String(course.id);
    targetPath.subject = String(subject.id);

    return {
      trigger: 'SUBJECT_COMPLETE',
      targetId: String(subject.id),
      targetLabel: subject.name,
      course: course ? { id: course.id, title: course.title } : null,
      subject: { id: subject.id, title: subject.name, name: subject.name },
      targetPath,
    };
  }

  /**
   * 3. Target hierarchy for Module trigger (MODULE_COMPLETE)
   */
  async getModuleTargetHierarchy(id: number): Promise<TargetHierarchyResult> {
    const moduleItem = await this.prisma.module.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        subject: {
          select: {
            id: true,
            name: true,
            courses: {
              select: {
                course: { select: { id: true, title: true } },
              },
              take: 1,
            },
          },
        },
      },
    });
    if (!moduleItem) {
      throw new NotFoundException(`Module with ID ${id} not found`);
    }

    const subject = moduleItem.subject ?? null;
    const course = subject?.courses[0]?.course ?? null;

    const targetPath: Record<string, string> = {};
    if (course) targetPath.course = String(course.id);
    if (subject) targetPath.subject = String(subject.id);
    targetPath.module = String(moduleItem.id);

    return {
      trigger: 'MODULE_COMPLETE',
      targetId: String(moduleItem.id),
      targetLabel: moduleItem.title,
      course: course ? { id: course.id, title: course.title } : null,
      subject: subject
        ? { id: subject.id, title: subject.name, name: subject.name }
        : null,
      module: { id: moduleItem.id, title: moduleItem.title },
      targetPath,
    };
  }

  /**
   * 4. Target hierarchy for Chapter trigger (CHAPTER_COMPLETE)
   */
  async getChapterTargetHierarchy(id: number): Promise<TargetHierarchyResult> {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        modules: {
          select: {
            module: {
              select: {
                id: true,
                title: true,
                subject: {
                  select: {
                    id: true,
                    name: true,
                    courses: {
                      select: {
                        course: { select: { id: true, title: true } },
                      },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
          take: 1,
        },
        subjects: {
          select: {
            subject: {
              select: {
                id: true,
                name: true,
                courses: {
                  select: {
                    course: { select: { id: true, title: true } },
                  },
                  take: 1,
                },
              },
            },
          },
          take: 1,
        },
      },
    });
    if (!chapter) {
      throw new NotFoundException(`Chapter with ID ${id} not found`);
    }

    const moduleItem = chapter.modules[0]?.module ?? null;
    const subject = moduleItem?.subject ?? chapter.subjects[0]?.subject ?? null;
    const course = subject?.courses[0]?.course ?? null;

    const targetPath: Record<string, string> = {};
    if (course) targetPath.course = String(course.id);
    if (subject) targetPath.subject = String(subject.id);
    if (moduleItem) targetPath.module = String(moduleItem.id);
    targetPath.chapter = String(chapter.id);

    return {
      trigger: 'CHAPTER_COMPLETE',
      targetId: String(chapter.id),
      targetLabel: chapter.title,
      course: course ? { id: course.id, title: course.title } : null,
      subject: subject
        ? { id: subject.id, title: subject.name, name: subject.name }
        : null,
      module: moduleItem
        ? { id: moduleItem.id, title: moduleItem.title }
        : null,
      chapter: { id: chapter.id, title: chapter.title },
      targetPath,
    };
  }

  /**
   * 5. Target hierarchy for Lesson trigger (LESSON_COMPLETE)
   */
  async getLessonTargetHierarchy(id: number): Promise<TargetHierarchyResult> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        chapters: {
          select: {
            chapter: {
              select: {
                id: true,
                title: true,
                modules: {
                  select: {
                    module: {
                      select: {
                        id: true,
                        title: true,
                        subject: {
                          select: {
                            id: true,
                            name: true,
                            courses: {
                              select: {
                                course: { select: { id: true, title: true } },
                              },
                              take: 1,
                            },
                          },
                        },
                      },
                    },
                  },
                  take: 1,
                },
                subjects: {
                  select: {
                    subject: {
                      select: {
                        id: true,
                        name: true,
                        courses: {
                          select: {
                            course: { select: { id: true, title: true } },
                          },
                          take: 1,
                        },
                      },
                    },
                  },
                  take: 1,
                },
              },
            },
          },
          take: 1,
        },
      },
    });
    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${id} not found`);
    }

    const chapter = lesson.chapters[0]?.chapter ?? null;
    const moduleItem = chapter?.modules[0]?.module ?? null;
    const subject =
      moduleItem?.subject ?? chapter?.subjects[0]?.subject ?? null;
    const course = subject?.courses[0]?.course ?? null;

    const targetPath: Record<string, string> = {};
    if (course) targetPath.course = String(course.id);
    if (subject) targetPath.subject = String(subject.id);
    if (moduleItem) targetPath.module = String(moduleItem.id);
    if (chapter) targetPath.chapter = String(chapter.id);
    targetPath.lesson = String(lesson.id);

    return {
      trigger: 'LESSON_COMPLETE',
      targetId: String(lesson.id),
      targetLabel: lesson.title,
      course: course ? { id: course.id, title: course.title } : null,
      subject: subject
        ? { id: subject.id, title: subject.name, name: subject.name }
        : null,
      module: moduleItem
        ? { id: moduleItem.id, title: moduleItem.title }
        : null,
      chapter: chapter ? { id: chapter.id, title: chapter.title } : null,
      lesson: { id: lesson.id, title: lesson.title },
      targetPath,
    };
  }

  /**
   * 6. Target hierarchy for Quiz trigger (QUIZ_COMPLETE)
   */
  async getQuizTargetHierarchy(id: number): Promise<TargetHierarchyResult> {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        lessons: {
          select: {
            lesson: {
              select: {
                id: true,
                title: true,
                chapters: {
                  select: {
                    chapter: {
                      select: {
                        id: true,
                        title: true,
                        modules: {
                          select: {
                            module: {
                              select: {
                                id: true,
                                title: true,
                                subject: {
                                  select: {
                                    id: true,
                                    name: true,
                                    courses: {
                                      select: {
                                        course: {
                                          select: { id: true, title: true },
                                        },
                                      },
                                      take: 1,
                                    },
                                  },
                                },
                              },
                            },
                          },
                          take: 1,
                        },
                        subjects: {
                          select: {
                            subject: {
                              select: {
                                id: true,
                                name: true,
                                courses: {
                                  select: {
                                    course: {
                                      select: { id: true, title: true },
                                    },
                                  },
                                  take: 1,
                                },
                              },
                            },
                          },
                          take: 1,
                        },
                      },
                    },
                  },
                  take: 1,
                },
              },
            },
          },
          take: 1,
        },
        chapterQuizzes: {
          select: {
            chapter: {
              select: {
                id: true,
                title: true,
                modules: {
                  select: {
                    module: {
                      select: {
                        id: true,
                        title: true,
                        subject: {
                          select: {
                            id: true,
                            name: true,
                            courses: {
                              select: {
                                course: {
                                  select: { id: true, title: true },
                                },
                              },
                              take: 1,
                            },
                          },
                        },
                      },
                    },
                  },
                  take: 1,
                },
                subjects: {
                  select: {
                    subject: {
                      select: {
                        id: true,
                        name: true,
                        courses: {
                          select: {
                            course: {
                              select: { id: true, title: true },
                            },
                          },
                          take: 1,
                        },
                      },
                    },
                  },
                  take: 1,
                },
              },
            },
          },
          take: 1,
        },
        moduleQuizzes: {
          select: {
            module: {
              select: {
                id: true,
                title: true,
                subject: {
                  select: {
                    id: true,
                    name: true,
                    courses: {
                      select: {
                        course: { select: { id: true, title: true } },
                      },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
          take: 1,
        },
        subjectQuizzes: {
          select: {
            subject: {
              select: {
                id: true,
                name: true,
                courses: {
                  select: {
                    course: { select: { id: true, title: true } },
                  },
                  take: 1,
                },
              },
            },
          },
          take: 1,
        },
        courseQuizzes: {
          select: {
            course: { select: { id: true, title: true } },
          },
          take: 1,
        },
      },
    });
    if (!quiz) {
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }

    const lesson = quiz.lessons[0]?.lesson ?? null;
    const chapter =
      lesson?.chapters[0]?.chapter ?? quiz.chapterQuizzes[0]?.chapter ?? null;
    const moduleItem =
      chapter?.modules[0]?.module ?? quiz.moduleQuizzes[0]?.module ?? null;
    const subject =
      moduleItem?.subject ??
      chapter?.subjects[0]?.subject ??
      quiz.subjectQuizzes[0]?.subject ??
      null;
    const course =
      subject?.courses[0]?.course ?? quiz.courseQuizzes[0]?.course ?? null;

    const targetPath: Record<string, string> = {};
    if (course) targetPath.course = String(course.id);
    if (subject) targetPath.subject = String(subject.id);
    if (moduleItem) targetPath.module = String(moduleItem.id);
    if (chapter) targetPath.chapter = String(chapter.id);
    if (lesson) targetPath.lesson = String(lesson.id);
    targetPath.quiz = String(quiz.id);

    return {
      trigger: 'QUIZ_COMPLETE',
      targetId: String(quiz.id),
      targetLabel: quiz.title,
      course: course ? { id: course.id, title: course.title } : null,
      subject: subject
        ? { id: subject.id, title: subject.name, name: subject.name }
        : null,
      module: moduleItem
        ? { id: moduleItem.id, title: moduleItem.title }
        : null,
      chapter: chapter ? { id: chapter.id, title: chapter.title } : null,
      lesson: lesson ? { id: lesson.id, title: lesson.title } : null,
      quiz: { id: quiz.id, title: quiz.title },
      targetPath,
    };
  }

  /**
   * Unified resolver routing to each specific trigger hierarchy method.
   */
  async resolveTargetHierarchy(
    trigger: string,
    targetId: string,
  ): Promise<TargetHierarchyResult> {
    const id = parseInt(targetId, 10);
    if (isNaN(id)) {
      throw new BadRequestException(`Invalid targetId: ${targetId}`);
    }

    const t = (trigger || '').toUpperCase();
    if (t === 'COURSE_COMPLETE' || t === 'COURSE_COMPLETED') {
      return this.getCourseTargetHierarchy(id);
    }
    if (t === 'SUBJECT_COMPLETE' || t === 'SUBJECT_COMPLETED') {
      return this.getSubjectTargetHierarchy(id);
    }
    if (t === 'MODULE_COMPLETE' || t === 'MODULE_COMPLETED') {
      return this.getModuleTargetHierarchy(id);
    }
    if (t === 'CHAPTER_COMPLETE' || t === 'CHAPTER_COMPLETED') {
      return this.getChapterTargetHierarchy(id);
    }
    if (t === 'LESSON_COMPLETE' || t.startsWith('LESSON_')) {
      return this.getLessonTargetHierarchy(id);
    }
    if (t === 'QUIZ_COMPLETE' || t.startsWith('QUIZ_')) {
      return this.getQuizTargetHierarchy(id);
    }

    throw new BadRequestException(
      `Unsupported trigger type for target hierarchy: ${trigger}`,
    );
  }

  /**
   * GET /badge/course-status/:courseId
   * Computes badges & certificate metrics for a specific course and user.
   */
  async getCourseRewardsStatus(courseIdOrSlug: number | string, userId: number) {
    const numId = Number(courseIdOrSlug);
    const whereCourse = !isNaN(numId)
      ? { id: numId }
      : { slug: String(courseIdOrSlug) };

    const course = await this.prisma.course.findFirst({
      where: whereCourse,
      include: {
        courseQuizzes: { select: { quizId: true } },
        subjects: {
          include: {
            subject: {
              include: {
                subjectQuizzes: { select: { quizId: true } },
                modules: {
                  include: {
                    moduleQuizzes: { select: { quizId: true } },
                    chapters: {
                      include: {
                        chapter: {
                          include: {
                            chapterQuizzes: { select: { quizId: true } },
                            lessons: {
                              include: {
                                lesson: {
                                  include: {
                                    quizzes: { select: { quizId: true } },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                chapters: {
                  include: {
                    chapter: {
                      include: {
                        chapterQuizzes: { select: { quizId: true } },
                        lessons: {
                          include: {
                            lesson: {
                              include: {
                                quizzes: { select: { quizId: true } },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course ${courseIdOrSlug} not found`);
    }
    const courseId = course.id;

    const allLessonIds = new Set<number>();
    const allQuizIds = new Set<number>();
    const allChapterIds = new Set<number>();
    const allModuleIds = new Set<number>();
    const allSubjectIds = new Set<number>();

    course.courseQuizzes?.forEach((cq) => allQuizIds.add(cq.quizId));

    for (const cs of course.subjects ?? []) {
      const subject = cs.subject;
      if (!subject) continue;
      allSubjectIds.add(subject.id);
      subject.subjectQuizzes?.forEach((sq) => allQuizIds.add(sq.quizId));

      for (const mod of subject.modules ?? []) {
        allModuleIds.add(mod.id);
        mod.moduleQuizzes?.forEach((mq) => allQuizIds.add(mq.quizId));

        for (const mc of mod.chapters ?? []) {
          const ch = mc.chapter;
          if (!ch) continue;
          allChapterIds.add(ch.id);
          ch.chapterQuizzes?.forEach((cq) => allQuizIds.add(cq.quizId));
          for (const ltc of ch.lessons ?? []) {
            if (ltc.lesson) {
              allLessonIds.add(ltc.lesson.id);
              ltc.lesson.quizzes?.forEach((lq) => allQuizIds.add(lq.quizId));
            }
          }
        }
      }

      for (const sc of subject.chapters ?? []) {
        const ch = sc.chapter;
        if (!ch) continue;
        allChapterIds.add(ch.id);
        ch.chapterQuizzes?.forEach((cq) => allQuizIds.add(cq.quizId));
        for (const ltc of ch.lessons ?? []) {
          if (ltc.lesson) {
            allLessonIds.add(ltc.lesson.id);
            ltc.lesson.quizzes?.forEach((lq) => allQuizIds.add(lq.quizId));
          }
        }
      }
    }

    const allActiveBadges = await this.prisma.badge.findMany({
      where: { isActive: true },
      select: {
        id: true,
        category: true,
        conditionType: true,
        targetScope: true,
        targetId: true,
        targetPath: true,
      },
    });

    const courseBadgeIds: number[] = [];

    for (const b of allActiveBadges) {
      let matchesCourse = false;
      const targetPath = b.targetPath as Record<string, unknown> | null;
      const rawPathCourse = targetPath?.course ?? targetPath?.courseId;
      const pathCourse =
        typeof rawPathCourse === 'string' || typeof rawPathCourse === 'number'
          ? String(rawPathCourse)
          : null;

      if (pathCourse && pathCourse === String(courseId)) {
        matchesCourse = true;
      } else {
        const cond = (b.conditionType || '').toUpperCase();
        const tid = b.targetId ? Number(b.targetId) : null;

        if (b.targetScope === BadgeTargetScope.SPECIFIC) {
          if (
            cond.includes('COURSE') &&
            String(b.targetId) === String(courseId)
          ) {
            matchesCourse = true;
          } else if (tid != null && !isNaN(tid)) {
            if (cond.includes('LESSON') && allLessonIds.has(tid)) {
              matchesCourse = true;
            } else if (cond.includes('QUIZ') && allQuizIds.has(tid)) {
              matchesCourse = true;
            } else if (cond.includes('CHAPTER') && allChapterIds.has(tid)) {
              matchesCourse = true;
            } else if (cond.includes('MODULE') && allModuleIds.has(tid)) {
              matchesCourse = true;
            } else if (cond.includes('SUBJECT') && allSubjectIds.has(tid)) {
              matchesCourse = true;
            }
          }
        } else if (b.targetScope === BadgeTargetScope.ALL) {
          if (cond.includes('COURSE')) {
            matchesCourse = true;
          } else if (
            b.category === BadgeCategory.LEARNING ||
            b.category === BadgeCategory.QUIZ
          ) {
            if (cond.includes('LESSON') && allLessonIds.size > 0)
              matchesCourse = true;
            else if (cond.includes('QUIZ') && allQuizIds.size > 0)
              matchesCourse = true;
            else if (cond.includes('CHAPTER') && allChapterIds.size > 0)
              matchesCourse = true;
            else if (cond.includes('MODULE') && allModuleIds.size > 0)
              matchesCourse = true;
            else if (cond.includes('SUBJECT') && allSubjectIds.size > 0)
              matchesCourse = true;
          }
        }
      }

      if (matchesCourse) {
        courseBadgeIds.push(b.id);
      }
    }

    const totalBadge = courseBadgeIds.length;

    // Fetch full badge records and user earned state for these course badges
    const courseBadges =
      courseBadgeIds.length > 0
        ? await this.prisma.badge.findMany({
            where: { id: { in: courseBadgeIds }, isActive: true },
            orderBy: [{ category: 'asc' }, { rarity: 'asc' }],
          })
        : [];

    const userBadges =
      courseBadgeIds.length > 0
        ? await this.prisma.userBadge.findMany({
            where: {
              userId,
              badgeId: { in: courseBadgeIds },
            },
          })
        : [];

    const earnedMap = new Map(userBadges.map((ub) => [ub.badgeId, ub]));
    const totalEarnedBadge = userBadges.length;

    const items = courseBadges.map((badge) => {
      const earned = earnedMap.get(badge.id);
      return {
        id: badge.id,
        name: badge.name,
        slug: badge.slug,
        description: badge.description || badge.shortDescription || '',
        shortDescription: badge.shortDescription,
        icon: badge.icon,
        background: badge.background,
        category: badge.category,
        rarity: badge.rarity,
        conditionType: badge.conditionType,
        targetScope: badge.targetScope,
        targetLabel: badge.targetLabel,
        xpReward: badge.xpRewardEngagement,
        isEarned: !!earned,
        earnedAt: earned?.earnedAt || null,
      };
    });

    const courseSpecificTemplates = await this.prisma.certificateTemplate.count(
      {
        where: {
          courseId,
          status: true,
        },
      },
    );

    const defaultTemplates = await this.prisma.certificateTemplate.count({
      where: {
        type: 'course',
        isDefault: true,
        status: true,
        courseId: null,
      },
    });

    const totalCertificates =
      courseSpecificTemplates > 0
        ? courseSpecificTemplates
        : defaultTemplates > 0
          ? defaultTemplates
          : 0;

    const totalEarnedCertificates =
      await this.prisma.userCompletionCertificate.count({
        where: {
          userId,
          courseId,
        },
      });

    return {
      courseId,
      totalBadge,
      totalBadges: totalBadge,
      totalEarnedBadge,
      totalEarnedBadges: totalEarnedBadge,
      totalCertificates,
      totalCerticates: totalCertificates,
      totalEarnedCertificates,
      badges: {
        earned: totalEarnedBadge,
        total: totalBadge,
      },
      certificates: {
        earned: totalEarnedCertificates,
        total: totalCertificates,
      },
      items,
      badgesList: items,
    };
  }
}
