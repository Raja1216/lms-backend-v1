import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  Badge,
  BadgeTargetScope,
  XpSourceType,
  XpType,
} from '../../generated/prisma/client';
import {
  BadgeScopeCompletionJobData,
  DirectBadgeAwardJobData,
} from '../services/badge-dispatcher.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';

@Processor('badge-award')
@Injectable()
export class BadgeProcessor extends WorkerHost {
  private readonly logger = new Logger(BadgeProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogService: ActivityLogService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(
      `[BadgeProcessor] Processing job ${job.id} [name=${job.name}]`,
    );

    switch (job.name) {
      case 'scope-completed':
        return await this.handleScopeCompleted(
          job.data as BadgeScopeCompletionJobData,
        );
      case 'award-badge':
        return await this.handleDirectAward(
          job.data as DirectBadgeAwardJobData,
        );
      default:
        this.logger.warn(`[BadgeProcessor] Unknown job name: ${job.name}`);
        return null;
    }
  }

  /**
   * Evaluates active badges against a completed scope and awards qualifying badges to the user.
   */
  private async handleScopeCompleted(
    data: BadgeScopeCompletionJobData,
  ): Promise<{ awardedBadges: string[] }> {
    const { userId, trigger, targetId, courseId, sourceType, metadata } = data;
    const rawTrigger = (trigger || '').toUpperCase();
    const awardedBadges: string[] = [];

    this.logger.log(
      `[BadgeProcessor] Evaluating scope badges for user ${userId} on trigger ${rawTrigger} (targetId=${targetId ?? 'N/A'})`,
    );

    // 1. Evaluate primary scope matching badges
    const candidateBadges = await this.findCandidateBadges(rawTrigger);

    for (const badge of candidateBadges) {
      const qualifies = await this.evaluateBadgeEligibility(
        badge,
        userId,
        rawTrigger,
        targetId,
        courseId,
        metadata,
      );

      if (qualifies) {
        const awarded = await this.saveUserBadge(
          userId,
          badge,
          sourceType ?? XpSourceType.SYSTEM,
          targetId ? String(targetId) : undefined,
          courseId,
        );
        if (awarded) {
          awardedBadges.push(badge.name);
        }
      }
    }

    // 2. Cascade checks for hierarchical scopes
    // If a lesson was completed, check if its parent chapter, module, subject, or course became complete
    if (this.isLessonTrigger(rawTrigger) && targetId) {
      const lessonId = Number(targetId);
      if (!isNaN(lessonId)) {
        await this.checkCascadingScopeCompletions(
          userId,
          lessonId,
          courseId,
          awardedBadges,
        );
      }
    }

    // If a module was completed, check parent subject and course
    if (this.isModuleTrigger(rawTrigger) && targetId) {
      const moduleId = Number(targetId);
      if (!isNaN(moduleId)) {
        await this.checkCascadingSubjectAndCourseFromModule(
          userId,
          moduleId,
          courseId,
          awardedBadges,
        );
      }
    }

    // If a subject or quiz was completed, check course completion
    if (
      (this.isSubjectTrigger(rawTrigger) || this.isQuizTrigger(rawTrigger)) &&
      courseId
    ) {
      await this.checkCourseCompletionBadges(userId, courseId, awardedBadges);
    }

    return { awardedBadges };
  }

  /**
   * Handle direct badge award job by badgeId or badgeSlug
   */
  private async handleDirectAward(
    data: DirectBadgeAwardJobData,
  ): Promise<boolean> {
    const { userId, badgeId, badgeSlug, sourceType, sourceId } = data;

    const badge = await this.prisma.badge.findFirst({
      where: {
        OR: [
          ...(badgeId ? [{ id: badgeId }] : []),
          ...(badgeSlug ? [{ slug: badgeSlug }] : []),
        ],
        isActive: true,
      },
    });

    if (!badge) {
      this.logger.warn(
        `[BadgeProcessor] Badge not found or inactive for direct award [badgeId=${badgeId} slug=${badgeSlug}]`,
      );
      return false;
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
      this.logger.debug(
        `[BadgeProcessor] User ${userId} already has badge ${badge.name}`,
      );
      return false;
    }

    return await this.saveUserBadge(
      userId,
      badge,
      sourceType ?? XpSourceType.SYSTEM,
      sourceId,
    );
  }

  /**
   * Determine whether a user qualifies for a given badge.
   */
  private async evaluateBadgeEligibility(
    badge: Badge,
    userId: number,
    trigger: string,
    targetId?: string | number,
    courseId?: number,
    metadata?: Record<string, any>,
  ): Promise<boolean> {
    // Check if user already owns this badge
    const existing = await this.prisma.userBadge.findUnique({
      where: {
        userId_badgeId: {
          userId,
          badgeId: badge.id,
        },
      },
    });

    if (existing) {
      return false;
    }

    // Handle SPECIFIC target scope
    if (badge.targetScope === BadgeTargetScope.SPECIFIC) {
      if (!badge.targetId) {
        return false;
      }
      const targetStr =
        targetId !== undefined && targetId !== null ? String(targetId) : '';
      const courseStr =
        courseId !== undefined && courseId !== null ? String(courseId) : '';
      const badgeTargetStr = String(badge.targetId);

      const matchesTarget =
        badgeTargetStr === targetStr || badgeTargetStr === courseStr;

      if (!matchesTarget) {
        return false;
      }
    }

    // Handle ALL target scope with milestone thresholds
    if (badge.targetScope === BadgeTargetScope.ALL) {
      const threshold = badge.threshold ?? 1;
      if (threshold > 1) {
        const count = await this.getMilestoneCount(
          userId,
          badge.conditionType,
          trigger,
        );
        if (count < threshold) {
          return false;
        }
      }
    }

    // Special slug/milestone checks (seeded default badges)
    if (badge.slug === 'getting-started') {
      const streak = await this.getUserMaxStreak(userId);
      return streak >= 3;
    }
    if (badge.slug === 'weekly-warrior') {
      const streak = await this.getUserMaxStreak(userId);
      return streak >= 7;
    }
    if (badge.slug === 'consistency-builder') {
      const streak = await this.getUserMaxStreak(userId);
      return streak >= 14;
    }
    if (badge.slug === 'consistent-learner') {
      const streak = await this.getUserMaxStreak(userId);
      return streak >= 30;
    }
    if (badge.slug === 'determined-learner') {
      const streak = await this.getUserMaxStreak(userId);
      return streak >= 60;
    }
    if (badge.slug === 'unstoppable') {
      const streak = await this.getUserMaxStreak(userId);
      return streak >= 100;
    }
    if (badge.slug === 'year-warrior') {
      const streak = await this.getUserMaxStreak(userId);
      return streak >= 365;
    }
    if (badge.slug === 'perfect-score') {
      const scorePct =
        typeof metadata?.scorePct === 'number' ? metadata.scorePct : 0;
      return scorePct >= 100 || trigger === 'QUIZ_SCORE_100';
    }

    return true;
  }

  /**
   * Persist UserBadge to DB and award XP if configured.
   */
  private async saveUserBadge(
    userId: number,
    badge: Badge,
    sourceType: XpSourceType,
    sourceId?: string,
    courseId?: number,
  ): Promise<boolean> {
    try {
      await this.prisma.userBadge.create({
        data: {
          userId,
          badgeId: badge.id,
          sourceType,
          sourceId:
            sourceId ??
            (badge.targetId ? String(badge.targetId) : String(badge.id)),
        },
      });

      this.logger.log(
        `[BadgeProcessor] 🏆 BADGE GENERATED & SAVED TO DB: "${badge.name}" (${badge.slug}) for User ${userId}`,
      );

      // Award bonus XP if badge carries XP reward
      if (badge.xpRewardEngagement > 0) {
        await this.awardBadgeXpReward(userId, badge, courseId);
      }

      // Log in Activity Log (best effort)
      try {
        await this.activityLogService.logActivity(
          userId,
          'XP Earned',
          courseId,
          badge.xpRewardEngagement > 0
            ? { xpPoints: badge.xpRewardEngagement }
            : undefined,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to log activity for badge: ${msg}`);
      }

      return true;
    } catch (err: unknown) {
      // Catch P2002 duplicate key constraint if awarded concurrently
      const prismaErr = err as {
        code?: string;
        message?: string;
        stack?: string;
      };
      if (prismaErr?.code === 'P2002') {
        this.logger.debug(
          `[BadgeProcessor] User ${userId} already has badge ${badge.id} (P2002 duplicate ignored)`,
        );
        return false;
      }
      this.logger.error(
        `[BadgeProcessor] Failed to save user badge: ${prismaErr?.message || String(err)}`,
        prismaErr?.stack,
      );
      throw err;
    }
  }

  /**
   * Awards bonus XP attached to the badge atomically.
   */
  private async awardBadgeXpReward(
    userId: number,
    badge: Badge,
    courseId?: number,
  ): Promise<void> {
    const xpAmount = badge.xpRewardEngagement;
    if (xpAmount <= 0) return;

    const idempotencyKey = `BADGE_BONUS_XP:U_${userId}:B_${badge.id}`;

    const existingTx = await this.prisma.xpTransaction.findUnique({
      where: { idempotencyKey },
    });
    if (existingTx) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.xpTransaction.create({
        data: {
          userId,
          xpType: XpType.ENGAGEMENT,
          xpAmount,
          eventKey: 'BADGE_AWARDED',
          sourceType: XpSourceType.SYSTEM,
          sourceId: String(badge.id),
          courseId,
          idempotencyKey,
          metadata: {
            badgeId: badge.id,
            badgeName: badge.name,
            badgeSlug: badge.slug,
          },
        },
      });

      const wallet = await tx.userXpWallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        let levelId = 1;
        const firstLevel = await tx.gamificationLevel.findFirst({
          orderBy: { levelNumber: 'asc' },
          select: { id: true },
        });

        if (firstLevel) {
          levelId = firstLevel.id;
        } else {
          const createdLevel = await tx.gamificationLevel.create({
            data: {
              levelNumber: 1,
              title: 'Beginner',
              minimumTotalXp: 0,
              minimumPerformanceXp: 0,
            },
          });
          levelId = createdLevel.id;
        }

        await tx.userXpWallet.create({
          data: {
            userId,
            engagementXp: xpAmount,
            performanceXp: 0,
            totalXp: xpAmount,
            currentLevelId: levelId,
          },
        });
      } else {
        await tx.userXpWallet.update({
          where: { id: wallet.id },
          data: {
            engagementXp: { increment: xpAmount },
            totalXp: { increment: xpAmount },
          },
        });
      }
    });

    this.logger.log(
      `[BadgeProcessor] +${xpAmount} Engagement XP awarded to user ${userId} for badge "${badge.name}"`,
    );
  }

  /**
   * Find candidate badges that match the trigger or its mapped aliases.
   */
  private async findCandidateBadges(trigger: string): Promise<Badge[]> {
    const triggers = this.expandTriggerSynonyms(trigger);

    return await this.prisma.badge.findMany({
      where: {
        isActive: true,
        OR: [{ conditionType: { in: triggers } }, { conditionType: trigger }],
      },
    });
  }

  /**
   * Expand trigger into all equivalent frontend and backend condition keys.
   */
  private expandTriggerSynonyms(trigger: string): string[] {
    const t = trigger.toUpperCase();
    const set = new Set<string>([t, 'COUNT_THRESHOLD']);

    if (this.isLessonTrigger(t)) {
      set.add('LESSON_COMPLETE');
      set.add('LESSON_VIDEO_COMPLETED');
      set.add('LESSON_DOCUMENT_COMPLETED');
      set.add('LESSON_ARTICLE_COMPLETED');
      set.add('LESSON_AUDIO_COMPLETED');
      set.add('LESSON_INTERACTIVE_COMPLETED');
    }

    if (this.isQuizTrigger(t)) {
      set.add('QUIZ_COMPLETE');
      set.add('QUIZ_PASSED_LESSON');
      set.add('QUIZ_SCORE_100');
      set.add('QUIZ_SCORE_90');
      set.add('QUIZ_SCORE_80');
      set.add('QUIZ_FIRST_ATTEMPT_PASS');
      set.add('QUIZ_ATTEMPTED');
      set.add('SPECIFIC_EVENT');
    }

    if (t === 'COURSE_COMPLETE' || t === 'COURSE_COMPLETED') {
      set.add('COURSE_COMPLETE');
      set.add('COURSE_COMPLETED');
      set.add('CERTIFICATION_COURSE_COMPLETED');
    }

    if (t === 'CHAPTER_COMPLETE' || t === 'CHAPTER_COMPLETED') {
      set.add('CHAPTER_COMPLETE');
      set.add('CHAPTER_COMPLETED');
    }

    if (t === 'MODULE_COMPLETE' || t === 'MODULE_COMPLETED') {
      set.add('MODULE_COMPLETE');
      set.add('MODULE_COMPLETED');
    }

    if (t === 'SUBJECT_COMPLETE' || t === 'SUBJECT_COMPLETED') {
      set.add('SUBJECT_COMPLETE');
      set.add('SUBJECT_COMPLETED');
    }

    if (t.startsWith('STREAK') || t === 'LOGIN_STREAK') {
      set.add('LOGIN_STREAK');
      set.add('STREAK_3_DAYS');
      set.add('STREAK_7_DAYS');
      set.add('STREAK_14_DAYS');
      set.add('STREAK_30_DAYS');
      set.add('STREAK_60_DAYS');
      set.add('STREAK_100_DAYS');
      set.add('STREAK');
    }

    return Array.from(set);
  }

  private isLessonTrigger(t: string): boolean {
    return t === 'LESSON_COMPLETE' || t.startsWith('LESSON_');
  }

  private isQuizTrigger(t: string): boolean {
    return (
      t === 'QUIZ_COMPLETE' || t.startsWith('QUIZ_') || t.startsWith('EXAM_')
    );
  }

  private isModuleTrigger(t: string): boolean {
    return t === 'MODULE_COMPLETE' || t === 'MODULE_COMPLETED';
  }

  private isSubjectTrigger(t: string): boolean {
    return t === 'SUBJECT_COMPLETE' || t === 'SUBJECT_COMPLETED';
  }

  /**
   * Count user milestone progression (lessons completed, quizzes passed, etc.)
   */
  private async getMilestoneCount(
    userId: number,
    conditionType: string,
    trigger: string,
  ): Promise<number> {
    const c = (conditionType || '').toUpperCase();
    const t = (trigger || '').toUpperCase();

    if (this.isLessonTrigger(c) || this.isLessonTrigger(t)) {
      return await this.prisma.userXPEarned.count({
        where: {
          userId,
          lessonId: { not: null },
        },
      });
    }

    if (this.isQuizTrigger(c) || this.isQuizTrigger(t)) {
      return await this.prisma.quizAttempt.count({
        where: { userId },
      });
    }

    if (this.isModuleTrigger(c) || this.isModuleTrigger(t)) {
      return await this.countCompletedModules(userId);
    }

    if (this.isSubjectTrigger(c) || this.isSubjectTrigger(t)) {
      return await this.countCompletedSubjects(userId);
    }

    if (
      c === 'COURSE_COMPLETE' ||
      c === 'COURSE_COMPLETED' ||
      t === 'COURSE_COMPLETE' ||
      t === 'COURSE_COMPLETED'
    ) {
      return await this.prisma.userCompletionCertificate.count({
        where: {
          userId,
          courseId: { not: null },
        },
      });
    }

    if (c.includes('STREAK') || t.includes('STREAK')) {
      return await this.getUserMaxStreak(userId);
    }

    if (c.includes('CERTIFICATE') || t.includes('CERTIFICATE')) {
      return await this.prisma.userCompletionCertificate.count({
        where: { userId },
      });
    }

    return 1;
  }

  private async getUserMaxStreak(userId: number): Promise<number> {
    const streak = await this.prisma.userStreak.findUnique({
      where: { userId },
    });
    return Math.max(streak?.currentStreak ?? 0, streak?.longestStreak ?? 0);
  }

  private async countCompletedModules(userId: number): Promise<number> {
    const modules = await this.prisma.module.findMany({
      where: { status: true },
      select: {
        id: true,
        chapters: {
          select: {
            chapter: {
              select: {
                lessons: {
                  select: { lessonId: true },
                },
              },
            },
          },
        },
      },
    });

    const completed = await this.prisma.userXPEarned.findMany({
      where: { userId, lessonId: { not: null } },
      select: { lessonId: true },
      distinct: ['lessonId'],
    });
    const completedSet = new Set(completed.map((c) => c.lessonId));

    let count = 0;
    for (const m of modules) {
      const lessonIds: number[] = [];
      for (const mc of m.chapters) {
        for (const lt of mc.chapter?.lessons ?? []) {
          lessonIds.push(lt.lessonId);
        }
      }
      if (
        lessonIds.length > 0 &&
        lessonIds.every((id) => completedSet.has(id))
      ) {
        count++;
      }
    }
    return count;
  }

  private async countCompletedSubjects(userId: number): Promise<number> {
    const subjects = await this.prisma.subject.findMany({
      where: { status: true },
      select: {
        id: true,
        modules: {
          select: {
            chapters: {
              select: {
                chapter: {
                  select: {
                    lessons: {
                      select: { lessonId: true },
                    },
                  },
                },
              },
            },
          },
        },
        chapters: {
          select: {
            chapter: {
              select: {
                lessons: {
                  select: { lessonId: true },
                },
              },
            },
          },
        },
      },
    });

    const completed = await this.prisma.userXPEarned.findMany({
      where: { userId, lessonId: { not: null } },
      select: { lessonId: true },
      distinct: ['lessonId'],
    });
    const completedSet = new Set(completed.map((c) => c.lessonId));

    let count = 0;
    for (const s of subjects) {
      const lessonIds: number[] = [];
      for (const m of s.modules) {
        for (const mc of m.chapters) {
          for (const lt of mc.chapter?.lessons ?? []) {
            lessonIds.push(lt.lessonId);
          }
        }
      }
      for (const sc of s.chapters) {
        for (const lt of sc.chapter?.lessons ?? []) {
          lessonIds.push(lt.lessonId);
        }
      }
      if (
        lessonIds.length > 0 &&
        lessonIds.every((id) => completedSet.has(id))
      ) {
        count++;
      }
    }
    return count;
  }

  /**
   * Cascading evaluation for Chapter, Module, Subject, and Course completion when a lesson completes.
   */
  private async checkCascadingScopeCompletions(
    userId: number,
    lessonId: number,
    courseId?: number,
    awardedBadges: string[] = [],
  ): Promise<void> {
    try {
      // Find parent chapters
      const lessonChapters = await this.prisma.lessonToChapter.findMany({
        where: { lessonId },
        select: { chapterId: true },
      });

      for (const lc of lessonChapters) {
        const chapterId = lc.chapterId;
        const allChapterLessons = await this.prisma.lessonToChapter.findMany({
          where: { chapterId },
          select: { lessonId: true },
        });

        const lessonIds = allChapterLessons.map((l) => l.lessonId);
        if (lessonIds.length > 0) {
          const completedCount = await this.prisma.userXPEarned.count({
            where: {
              userId,
              lessonId: { in: lessonIds },
            },
          });

          if (completedCount >= lessonIds.length) {
            // 1. Chapter complete! Evaluate CHAPTER_COMPLETE badges
            const chapterBadges =
              await this.findCandidateBadges('CHAPTER_COMPLETE');
            for (const b of chapterBadges) {
              const eligible = await this.evaluateBadgeEligibility(
                b,
                userId,
                'CHAPTER_COMPLETE',
                chapterId,
                courseId,
              );
              if (eligible) {
                const awarded = await this.saveUserBadge(
                  userId,
                  b,
                  XpSourceType.LESSON,
                  String(chapterId),
                  courseId,
                );
                if (awarded) awardedBadges.push(b.name);
              }
            }

            // 2. Check parent module(s) for this chapter
            const moduleChapters = await this.prisma.moduleChapter.findMany({
              where: { chapterId },
              select: { moduleId: true },
            });

            for (const mc of moduleChapters) {
              await this.checkModuleCompletion(
                userId,
                mc.moduleId,
                courseId,
                awardedBadges,
              );
            }

            // 3. Check direct parent subject(s) for this chapter (if chapter sits directly under subject)
            const subjectChapters = await this.prisma.subjectChapter.findMany({
              where: { chapterId },
              select: { subjectId: true },
            });

            for (const sc of subjectChapters) {
              await this.checkSubjectCompletion(
                userId,
                sc.subjectId,
                courseId,
                awardedBadges,
              );
            }
          }
        }
      }

      // Check course completion
      if (courseId) {
        await this.checkCourseCompletionBadges(userId, courseId, awardedBadges);
      }
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        `[BadgeProcessor] Error during cascading completion checks: ${e.message}`,
        e.stack,
      );
    }
  }

  /**
   * Check if a module is complete and evaluate MODULE_COMPLETE badges.
   */
  private async checkModuleCompletion(
    userId: number,
    moduleId: number,
    courseId?: number,
    awardedBadges: string[] = [],
  ): Promise<void> {
    const modChapters = await this.prisma.moduleChapter.findMany({
      where: { moduleId },
      select: { chapterId: true },
    });

    const chIds = modChapters.map((c) => c.chapterId);
    if (chIds.length === 0) return;

    const modLessons = await this.prisma.lessonToChapter.findMany({
      where: { chapterId: { in: chIds } },
      select: { lessonId: true },
    });

    const modLessonIds = modLessons.map((l) => l.lessonId);
    if (modLessonIds.length === 0) return;

    const completed = await this.prisma.userXPEarned.count({
      where: {
        userId,
        lessonId: { in: modLessonIds },
      },
    });

    if (completed >= modLessonIds.length) {
      // Module complete! Evaluate MODULE_COMPLETE badges
      const moduleBadges = await this.findCandidateBadges('MODULE_COMPLETE');
      for (const b of moduleBadges) {
        const eligible = await this.evaluateBadgeEligibility(
          b,
          userId,
          'MODULE_COMPLETE',
          moduleId,
          courseId,
        );
        if (eligible) {
          const awarded = await this.saveUserBadge(
            userId,
            b,
            XpSourceType.LESSON,
            String(moduleId),
            courseId,
          );
          if (awarded) awardedBadges.push(b.name);
        }
      }

      // Cascade to parent subject
      const modRecord = await this.prisma.module.findUnique({
        where: { id: moduleId },
        select: { subjectId: true },
      });

      if (modRecord?.subjectId) {
        await this.checkSubjectCompletion(
          userId,
          modRecord.subjectId,
          courseId,
          awardedBadges,
        );
      }
    }
  }

  /**
   * Check if a subject is complete and evaluate SUBJECT_COMPLETE badges.
   */
  private async checkSubjectCompletion(
    userId: number,
    subjectId: number,
    courseId?: number,
    awardedBadges: string[] = [],
  ): Promise<void> {
    const [subjModules, subjDirectChapters] = await Promise.all([
      this.prisma.module.findMany({
        where: { subjectId },
        select: { id: true },
      }),
      this.prisma.subjectChapter.findMany({
        where: { subjectId },
        select: { chapterId: true },
      }),
    ]);

    const moduleIds = subjModules.map((m) => m.id);
    const directChapterIds = subjDirectChapters.map((sc) => sc.chapterId);

    const modChapters = moduleIds.length
      ? await this.prisma.moduleChapter.findMany({
          where: { moduleId: { in: moduleIds } },
          select: { chapterId: true },
        })
      : [];

    const allChapterIds = [
      ...new Set([
        ...modChapters.map((mc) => mc.chapterId),
        ...directChapterIds,
      ]),
    ];

    if (allChapterIds.length === 0) return;

    const subjLessons = await this.prisma.lessonToChapter.findMany({
      where: { chapterId: { in: allChapterIds } },
      select: { lessonId: true },
    });

    const subjLessonIds = subjLessons.map((l) => l.lessonId);
    if (subjLessonIds.length === 0) return;

    const completed = await this.prisma.userXPEarned.count({
      where: {
        userId,
        lessonId: { in: subjLessonIds },
      },
    });

    if (completed >= subjLessonIds.length) {
      // Subject complete! Evaluate SUBJECT_COMPLETE badges
      const subjectBadges = await this.findCandidateBadges('SUBJECT_COMPLETE');
      for (const b of subjectBadges) {
        const eligible = await this.evaluateBadgeEligibility(
          b,
          userId,
          'SUBJECT_COMPLETE',
          subjectId,
          courseId,
        );
        if (eligible) {
          const awarded = await this.saveUserBadge(
            userId,
            b,
            XpSourceType.LESSON,
            String(subjectId),
            courseId,
          );
          if (awarded) awardedBadges.push(b.name);
        }
      }
    }
  }

  /**
   * Cascading subject and course check when a module completion is directly dispatched.
   */
  private async checkCascadingSubjectAndCourseFromModule(
    userId: number,
    moduleId: number,
    courseId?: number,
    awardedBadges: string[] = [],
  ): Promise<void> {
    const modRecord = await this.prisma.module.findUnique({
      where: { id: moduleId },
      select: { subjectId: true },
    });

    if (modRecord?.subjectId) {
      await this.checkSubjectCompletion(
        userId,
        modRecord.subjectId,
        courseId,
        awardedBadges,
      );
    }

    if (courseId) {
      await this.checkCourseCompletionBadges(userId, courseId, awardedBadges);
    }
  }

  /**
   * Check if course is complete and award course-level badges.
   */
  private async checkCourseCompletionBadges(
    userId: number,
    courseId: number,
    awardedBadges: string[] = [],
  ): Promise<void> {
    // Check if course completion certificate exists or was issued
    const cert = await this.prisma.userCompletionCertificate.findFirst({
      where: { userId, courseId },
    });

    if (cert) {
      const courseBadges = await this.findCandidateBadges('COURSE_COMPLETE');
      for (const b of courseBadges) {
        const eligible = await this.evaluateBadgeEligibility(
          b,
          userId,
          'COURSE_COMPLETE',
          courseId,
          courseId,
        );
        if (eligible) {
          const awarded = await this.saveUserBadge(
            userId,
            b,
            XpSourceType.COURSE,
            String(courseId),
            courseId,
          );
          if (awarded) awardedBadges.push(b.name);
        }
      }
    }
  }
}
