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
      const { userId, seconds } = job.data as { userId: number; seconds: number };
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;

      this.logger.log(
        `Processing time-spent job [userId=${userId} seconds=${seconds} date=${todayStr}]`,
      );

      try {
        await this.prisma.userTimeSpent.upsert({
          where: {
            userId_date: {
              userId,
              date: todayStr,
            },
          },
          create: {
            userId,
            date: todayStr,
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
      const { userId, action, courseId } = job.data as {
        userId: number;
        action: string;
        courseId?: number;
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
          },
        });
      } catch (err) {
        this.logger.error(`Failed to write activity log to database`, err);
        throw err;
      }
    }
  }
}
