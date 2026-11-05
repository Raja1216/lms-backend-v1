import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { XpSourceType } from '../../generated/prisma/client';

export interface BadgeScopeCompletionJobData {
  userId: number;
  trigger: string;
  targetId?: string | number;
  courseId?: number;
  sourceType?: XpSourceType;
  metadata?: Record<string, any>;
}

export interface DirectBadgeAwardJobData {
  userId: number;
  badgeId?: number;
  badgeSlug?: string;
  sourceType?: XpSourceType;
  sourceId?: string;
}

@Injectable()
export class BadgeDispatcherService {
  private readonly logger = new Logger(BadgeDispatcherService.name);

  constructor(@InjectQueue('badge-award') private readonly badgeQueue: Queue) {}

  /**
   * Dispatch a scope completion event to the BullMQ queue for badge evaluation.
   */
  async dispatchScopeCompletion(data: BadgeScopeCompletionJobData) {
    const targetKey =
      data.targetId !== undefined && data.targetId !== null
        ? String(data.targetId)
        : 'all';
    const jobId = `badge-scope_${data.userId}_${data.trigger}_${targetKey}_${Date.now()}`;

    try {
      const job = await this.badgeQueue.add('scope-completed', data, {
        jobId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      });

      this.logger.log(
        `[BadgeDispatcher] Dispatched scope-completed job [jobId=${job.id} userId=${data.userId} trigger=${data.trigger} targetId=${data.targetId ?? 'N/A'}]`,
      );

      return job;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const errStack = err instanceof Error ? err.stack : undefined;
      this.logger.error(
        `[BadgeDispatcher] Failed to dispatch scope completion job for user ${data.userId}: ${errMsg}`,
        errStack,
      );
      throw err;
    }
  }

  /**
   * Dispatch a direct badge award job to BullMQ.
   */
  async dispatchDirectAward(data: DirectBadgeAwardJobData) {
    const identifier = data.badgeId
      ? `id_${data.badgeId}`
      : `slug_${data.badgeSlug || 'unknown'}`;
    const jobId = `badge-award_${data.userId}_${identifier}_${Date.now()}`;

    try {
      const job = await this.badgeQueue.add('award-badge', data, {
        jobId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      });

      this.logger.log(
        `[BadgeDispatcher] Dispatched award-badge job [jobId=${job.id} userId=${data.userId} badge=${identifier}]`,
      );

      return job;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const errStack = err instanceof Error ? err.stack : undefined;
      this.logger.error(
        `[BadgeDispatcher] Failed to dispatch direct badge award for user ${data.userId}: ${errMsg}`,
        errStack,
      );
      throw err;
    }
  }
}
