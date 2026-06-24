import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ActivityPrismaService } from './activity-prisma.service';
import { Logger } from '@nestjs/common';
import { ActivityAction } from '../generated/logging-client/client';

@Processor('activity-log')
export class ActivityLogProcessor extends WorkerHost {
  private readonly logger = new Logger(ActivityLogProcessor.name);

  constructor(private readonly prisma: ActivityPrismaService) {
    super();
  }

  async process(job: Job) {
    if (job.name === 'time-spent') {
      const { userId, seconds, courseId } = job.data as {
        userId: number;
        seconds: number;
        courseId?: number;
      };
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;
      const cId = courseId ?? 0;

      this.logger.log(
        `Processing time-spent job [userId=${userId} seconds=${seconds} date=${todayStr} courseId=${cId}]`,
      );

      try {
        await this.prisma.userTimeSpent.upsert({
          where: {
            userId_date_courseId: {
              userId,
              date: todayStr,
              courseId: cId,
            },
          },
          create: {
            userId,
            date: todayStr,
            courseId: cId,
            seconds,
          },
          update: {
            seconds: {
              increment: seconds,
            },
          },
        });
      } catch (err) {
        this.logger.error(`Failed to record time spent to database`, err);
        throw err;
      }
    } else {
      const {
        userId,
        action,
        courseId,
        quizSubmissionId,
        projectSumissionId,
        lessonId,
        assigmentSumissionId,
        paymentId,
        quizId,
        productId,
        xpPoints,
      } = job.data as {
        userId: number;
        action: string;
        courseId?: number;
        quizSubmissionId?: number;
        projectSumissionId?: number;
        lessonId?: number;
        assigmentSumissionId?: number;
        paymentId?: number;
        quizId?: number;
        productId?: number;
        xpPoints?: number;
      };
      this.logger.log(
        `Processing activity log job [userId=${userId} action="${action}" courseId=${courseId}]`,
      );

      const prismaAction = action.replace(/ /g, '_') as ActivityAction;

      try {
        await this.prisma.userActivityLog.create({
          data: {
            userId,
            action: prismaAction,
            courseId,
            quizSubmissionId,
            projectSumissionId,
            lessonId,
            assigmentSumissionId,
            paymentId,
            quizId,
            productId,
            xpPoints,
          },
        });
      } catch (err) {
        this.logger.error(`Failed to write activity log to database`, err);
        throw err;
      }
    }
  }
}
