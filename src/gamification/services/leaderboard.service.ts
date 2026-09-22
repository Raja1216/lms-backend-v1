import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  LeaderboardPeriod,
  LeaderboardScope,
  LeaderboardMetric,
  LeaderboardQueryDto,
} from '../dto/leaderboard-query.dto';
import { XpType } from '../../generated/prisma/client';

export interface LeaderboardRankEntry {
  rank: number;
  userId: number;
  userName: string;
  avatar: string | null;
  score: number;
  isCurrentUser: boolean;
}

export interface LeaderboardResponse {
  period: LeaderboardPeriod;
  scope: LeaderboardScope;
  metric: LeaderboardMetric;
  topThree: LeaderboardRankEntry[];
  currentUserRank: LeaderboardRankEntry | null;
  neighbors: LeaderboardRankEntry[];
  totalLearners: number;
}

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch leaderboard rankings with top-3 podium and relative user position (±2 neighbors)
   */
  async getLeaderboard(
    currentUserId: number,
    query: LeaderboardQueryDto,
  ): Promise<LeaderboardResponse> {
    const period = query.period || LeaderboardPeriod.THIS_WEEK;
    const scope = query.scope || LeaderboardScope.GLOBAL;
    const metric = query.metric || LeaderboardMetric.PERFORMANCE;

    const { startDate, endDate } = this.getDateRangeForPeriod(period);

    // Build Prisma where conditions for XP transactions
    const txWhere: any = {};
    if (startDate) {
      txWhere.createdAt = { gte: startDate, lte: endDate };
    }

    if (scope === LeaderboardScope.COURSE && query.scopeId) {
      txWhere.courseId = query.scopeId;
    } else if (scope === LeaderboardScope.INSTITUTION && query.scopeId) {
      txWhere.institutionId = query.scopeId;
    }

    // Filter by Metric / XP Type
    if (metric === LeaderboardMetric.PERFORMANCE) {
      txWhere.xpType = XpType.PERFORMANCE;
    } else if (metric === LeaderboardMetric.ENGAGEMENT) {
      txWhere.xpType = XpType.ENGAGEMENT;
    } else if (metric === LeaderboardMetric.QUIZ) {
      txWhere.xpType = XpType.PERFORMANCE;
      txWhere.sourceType = 'QUIZ';
    } else if (metric === LeaderboardMetric.PROJECT) {
      txWhere.sourceType = 'PROJECT';
    } else if (metric === LeaderboardMetric.COMMUNITY) {
      txWhere.sourceType = 'COMMUNITY';
    }

    // Aggregate user scores from transactions in the period
    const aggregated = await this.prisma.xpTransaction.groupBy({
      by: ['userId'],
      where: txWhere,
      _sum: {
        xpAmount: true,
      },
      orderBy: {
        _sum: {
          xpAmount: 'desc',
        },
      },
    });

    const userIds = aggregated.map((a) => a.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, avatar: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Construct ranked list
    const rankedList: LeaderboardRankEntry[] = aggregated.map((item, index) => {
      const u = userMap.get(item.userId);
      return {
        rank: index + 1,
        userId: item.userId,
        userName: u?.name || `Learner #${item.userId}`,
        avatar: u?.avatar || null,
        score: item._sum.xpAmount || 0,
        isCurrentUser: item.userId === currentUserId,
      };
    });

    // Top 3 Podium
    const topThree = rankedList.slice(0, 3);

    // Locate current user in rankings
    const currentUserIndex = rankedList.findIndex((entry) => entry.userId === currentUserId);
    let currentUserRank: LeaderboardRankEntry | null = null;
    let neighbors: LeaderboardRankEntry[] = [];

    if (currentUserIndex !== -1) {
      currentUserRank = rankedList[currentUserIndex];
      // Get ±2 rank neighbors
      const startIdx = Math.max(0, currentUserIndex - 2);
      const endIdx = Math.min(rankedList.length, currentUserIndex + 3);
      neighbors = rankedList.slice(startIdx, endIdx);
    } else {
      // User has 0 score in this period, fetch their details
      const currentUser = await this.prisma.user.findUnique({
        where: { id: currentUserId },
        select: { id: true, name: true, avatar: true },
      });
      currentUserRank = {
        rank: rankedList.length + 1,
        userId: currentUserId,
        userName: currentUser?.name || 'You',
        avatar: currentUser?.avatar || null,
        score: 0,
        isCurrentUser: true,
      };
      neighbors = [currentUserRank];
    }

    return {
      period,
      scope,
      metric,
      topThree,
      currentUserRank,
      neighbors,
      totalLearners: rankedList.length,
    };
  }

  private getDateRangeForPeriod(period: LeaderboardPeriod): { startDate: Date | null; endDate: Date } {
    const now = new Date();
    const endDate = new Date(now);

    if (period === LeaderboardPeriod.ALL_TIME) {
      return { startDate: null, endDate };
    }

    const startDate = new Date(now);
    if (period === LeaderboardPeriod.TODAY) {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === LeaderboardPeriod.THIS_WEEK) {
      // Monday 00:00:00
      const day = startDate.getDay();
      const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
      startDate.setDate(diff);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === LeaderboardPeriod.THIS_MONTH) {
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    }

    return { startDate, endDate };
  }
}
