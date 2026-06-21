import { Injectable } from '@nestjs/common';
import { ActivityPrismaService } from './activity-prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class ActivityLogService {
  constructor(
    private readonly prisma: ActivityPrismaService,
    @InjectQueue('activity-log') private readonly activityLogQueue: Queue,
  ) {}

  async logActivity(userId: number, action: string, courseId?: number) {
    await this.activityLogQueue.add('log', {
      userId,
      action,
      courseId,
    });
  }

  async recordTimeSpent(userId: number, seconds: number) {
    await this.activityLogQueue.add('time-spent', {
      userId,
      seconds,
    });
  }

  async getDailyStreak(userId: number): Promise<number> {
    const logs = await this.prisma.userActivityLog.findMany({
      where: { userId },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    if (logs.length === 0) {
      return 0;
    }

    const dateStrings = Array.from(
      new Set(
        logs.map((log) => {
          const date = new Date(log.createdAt);
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const dd = String(date.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        }),
      ),
    );

    const today = new Date();
    const formatDate = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const todayStr = formatDate(today);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDate(yesterday);

    const latestActivityStr = dateStrings[0];
    if (latestActivityStr !== todayStr && latestActivityStr !== yesterdayStr) {
      return 0;
    }

    let streak = 0;
    const currentDate = new Date(latestActivityStr);

    while (true) {
      const currentStr = formatDate(currentDate);
      if (dateStrings.includes(currentStr)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }
}
