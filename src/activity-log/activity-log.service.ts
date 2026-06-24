import { Injectable } from '@nestjs/common';
import { ActivityPrismaService } from './activity-prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, ActivityAction } from '../generated/logging-client/client';

//  Action → Semantic Category Mapping
// Keep this map in the backend so the frontend never needs to interpret raw
// action strings.  Every action that ships in the logging DB must be listed here.
const ACTION_CATEGORY: Record<string, string> = {
  Login: 'login',
  'Quiz Submitted': 'exam',
  Quiz_Submitted: 'exam',
  'Project Grading': 'exam',
  Project_Grading: 'exam',
  'Assignment Submitted': 'exam',
  Assignment_Submitted: 'exam',
  'Certificate Generated': 'certificate',
  Certificate_Generated: 'certificate',
  Certificate: 'certificate',
  'Course Enrolled': 'enroll',
  Course_Enrolled: 'enroll',
  'Lesson Completed': 'lesson',
  Lesson_Completed: 'lesson',

  'Lesson Started': 'lesson',
  Lesson_Started: 'lesson',
  'Lesson Viewed': 'lesson',
  Lesson_Viewed: 'lesson',

  'Video Played': 'lesson',
  Video_Played: 'lesson',
  'Video Completed': 'lesson',
  Video_Completed: 'lesson',
  // "Course Viewed" is intentionally NOT mapped to "lesson"
  'Course Viewed': 'course_view',
  Course_Viewed: 'course_view',
  'Product Bought': 'purchase',
  Product_Bought: 'purchase',
  'Payment Success': 'purchase',
  Payment_Success: 'purchase',
  'XP Earned': 'xp',
  XP_Earned: 'xp',
  'Shop Page Visited': 'shop_cart',
  Shop_Page_Visited: 'shop_cart',
  'Cart Page Visited': 'shop_cart',
  Cart_Page_Visited: 'shop_cart',
};

function categorize(action: string): string {
  return ACTION_CATEGORY[action] ?? 'other';
}

@Injectable()
export class ActivityLogService {
  constructor(
    private readonly prisma: ActivityPrismaService,
    private readonly mainPrisma: PrismaService,
    @InjectQueue('activity-log') private readonly activityLogQueue: Queue,
  ) {}

  async logActivity(
    userId: number,
    action: string,
    courseId?: number,
    extra?: {
      quizSubmissionId?: number;
      projectSumissionId?: number;
      lessonId?: number;
      assigmentSumissionId?: number;
      paymentId?: number;
      quizId?: number;
      productId?: number;
      xpPoints?: number;
    },
  ) {
    await this.activityLogQueue.add('log', {
      userId,
      action,
      courseId,
      ...extra,
    });
  }

  async recordTimeSpent(userId: number, seconds: number, courseId?: number) {
    await this.activityLogQueue.add('time-spent', {
      userId,
      seconds,
      courseId,
    });
  }

  async getDailyStreak(userId: number): Promise<number> {
    const logs = await this.prisma.userActivityLog.findMany({
      where: { userId },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    if (logs.length === 0) return 0;

    const fmt = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const dateStrings = Array.from(
      new Set(logs.map((l) => fmt(new Date(l.createdAt)))),
    );
    const today = fmt(new Date());
    const yesterday = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return fmt(d);
    })();

    const latest = dateStrings[0];
    if (latest !== today && latest !== yesterday) return 0;

    let streak = 0;
    const cur = new Date(latest);
    while (dateStrings.includes(fmt(cur))) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    }
    return streak;
  }

  //  Admin aggregated dashboard (Optimized to return only necessary charts/stats)

  async getAdminDashboard(
    startDate: Date,
    endDate: Date,
    role?: string,
    keyword?: string,
  ) {
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    let matchedUserIds: number[] | null = null;
    let roleUserIds: number[] | null = null;

    if (role && role !== 'ALL') {
      const matchingUsers = await this.mainPrisma.user.findMany({
        where: { userType: role as any },
        select: { id: true },
      });
      roleUserIds = matchingUsers.map((u) => u.id);
      if (roleUserIds.length === 0) {
        matchedUserIds = [];
      }
    }

    if (keyword) {
      const userWhere: any = {
        OR: [{ name: { contains: keyword } }, { email: { contains: keyword } }],
      };
      if (roleUserIds) {
        userWhere.id = { in: roleUserIds };
      }
      const matchedUsers = await this.mainPrisma.user.findMany({
        where: userWhere,
        select: { id: true },
      });
      matchedUserIds = matchedUsers.map((u) => u.id);
    } else if (roleUserIds) {
      matchedUserIds = roleUserIds;
    }

    if (matchedUserIds !== null && matchedUserIds.length === 0) {
      return {
        stats: {
          login: 0,
          exam: 0,
          certificate: 0,
          enroll: 0,
          lesson: 0,
          purchase: 0,
          xp: 0,
          shop_cart: 0,
          course_view: 0,
          other: 0,
          xpTotal: 0,
          totalTimeSpent: 0,
          avgTime: 0,
          activeUsers: 0,
        },
        dailyTrend: [],
        courseBreakdown: [],
        activityDistribution: [],
      };
    }

    //  1. Aggregate action counts grouped by action & userId (one DB trip)
    const where: any = {
      createdAt: { gte: startDate, lte: endDate },
    };
    if (matchedUserIds) {
      where.userId = { in: matchedUserIds };
    }

    const rawCounts = await this.prisma.userActivityLog.groupBy({
      by: ['action', 'userId'],
      _count: { id: true },
      _sum: { xpPoints: true },
      where,
    });

    // 2. Daily event counts (for trend chart)
    const dailyEventRows = matchedUserIds
      ? await this.prisma.$queryRaw<
          Array<{ day: Date | string; count: bigint }>
        >`
          SELECT DATE(createdAt) as day, COUNT(*) as count
          FROM user_activity_logs
          WHERE createdAt >= ${startDate} AND createdAt <= ${endDate} AND userId IN (${Prisma.join(matchedUserIds)})
          GROUP BY DATE(createdAt)
          ORDER BY day ASC
        `
      : await this.prisma.$queryRaw<
          Array<{ day: Date | string; count: bigint }>
        >`
          SELECT DATE(createdAt) as day, COUNT(*) as count
          FROM user_activity_logs
          WHERE createdAt >= ${startDate} AND createdAt <= ${endDate}
          GROUP BY DATE(createdAt)
          ORDER BY day ASC
        `;

    //  3. Daily time spent (for trend chart)
    const dailyTimeRows = matchedUserIds
      ? await this.prisma.$queryRaw<Array<{ date: string; totalSecs: bigint }>>`
          SELECT date, SUM(seconds) as totalSecs
          FROM user_time_spent
          WHERE date >= ${startStr} AND date <= ${endStr} AND userId IN (${Prisma.join(matchedUserIds)})
          GROUP BY date
          ORDER BY date ASC
        `
      : await this.prisma.$queryRaw<Array<{ date: string; totalSecs: bigint }>>`
          SELECT date, SUM(seconds) as totalSecs
          FROM user_time_spent
          WHERE date >= ${startStr} AND date <= ${endStr}
          GROUP BY date
          ORDER BY date ASC
        `;

    //  4. Time spent per course (for course breakdown bar chart)
    const courseTimeRows = matchedUserIds
      ? await this.prisma.$queryRaw<
          Array<{ courseId: number | null; totalSecs: bigint }>
        >`
          SELECT courseId, SUM(seconds) as totalSecs
          FROM user_time_spent
          WHERE date >= ${startStr} AND date <= ${endStr} AND userId IN (${Prisma.join(matchedUserIds)})
          GROUP BY courseId
          ORDER BY totalSecs DESC
          LIMIT 20
        `
      : await this.prisma.$queryRaw<
          Array<{ courseId: number | null; totalSecs: bigint }>
        >`
          SELECT courseId, SUM(seconds) as totalSecs
          FROM user_time_spent
          WHERE date >= ${startStr} AND date <= ${endStr}
          GROUP BY courseId
          ORDER BY totalSecs DESC
          LIMIT 20
        `;

    //  5. Per-user total time spent for active user counts
    const userTimeRows = matchedUserIds
      ? await this.prisma.$queryRaw<
          Array<{ userId: number; totalSecs: bigint }>
        >`
          SELECT userId, SUM(seconds) as totalSecs
          FROM user_time_spent
          WHERE date >= ${startStr} AND date <= ${endStr} AND userId IN (${Prisma.join(matchedUserIds)})
          GROUP BY userId
        `
      : await this.prisma.$queryRaw<
          Array<{ userId: number; totalSecs: bigint }>
        >`
          SELECT userId, SUM(seconds) as totalSecs
          FROM user_time_spent
          WHERE date >= ${startStr} AND date <= ${endStr}
          GROUP BY userId
        `;

    //  6. Build lookup maps for courses
    const allCourseIds = [
      ...new Set([
        ...(courseTimeRows.map((r) => r.courseId).filter(Boolean) as number[]),
      ]),
    ];

    const courses = await this.mainPrisma.course.findMany({
      where: { id: { in: allCourseIds.length ? allCourseIds : [-1] } },
      select: { id: true, title: true },
    });

    const courseMap = courses.reduce<Map<number, string>>((m, c) => {
      m.set(c.id, c.title);
      return m;
    }, new Map());

    type StatBucket = {
      login: number;
      exam: number;
      certificate: number;
      enroll: number;
      lesson: number;
      purchase: number;
      xp: number;
      shop_cart: number;
      course_view: number;
      other: number;
    };
    const statsGlobal: StatBucket = {
      login: 0,
      exam: 0,
      certificate: 0,
      enroll: 0,
      lesson: 0,
      purchase: 0,
      xp: 0,
      shop_cart: 0,
      course_view: 0,
      other: 0,
    };
    let totalXp = 0;
    const activeUserIds = new Set<number>();

    for (const row of rawCounts) {
      const cat = categorize(row.action) as keyof StatBucket;
      const cnt = Number(row._count.id);
      if (cat in statsGlobal) statsGlobal[cat] += cnt;
      totalXp += Number(row._sum.xpPoints ?? 0);
      activeUserIds.add(row.userId);
    }

    const totalTimeSpent = userTimeRows.reduce(
      (s, row) => s + Number(row.totalSecs),
      0,
    );
    for (const row of userTimeRows) {
      activeUserIds.add(row.userId);
    }
    const avgTime =
      activeUserIds.size > 0
        ? Math.round(totalTimeSpent / activeUserIds.size)
        : 0;

    //  7. Daily trend for chart
    const trendMap = new Map<
      string,
      { date: string; activities: number; time: number }
    >();
    for (const row of dailyEventRows) {
      const day = String(row.day).slice(0, 10);
      trendMap.set(day, {
        date: day.slice(5),
        activities: Number(row.count),
        time: 0,
      });
    }
    for (const row of dailyTimeRows) {
      const day = String(row.date).slice(0, 10);
      if (!trendMap.has(day))
        trendMap.set(day, { date: day.slice(5), activities: 0, time: 0 });
      trendMap.get(day)!.time = Math.round(Number(row.totalSecs) / 60);
    }
    const dailyTrend = [...trendMap.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    //  8. Course breakdown for bar chart
    const courseBreakdown = courseTimeRows.map((row) => ({
      name: row.courseId
        ? (courseMap.get(row.courseId) ?? `Course #${row.courseId}`)
        : 'Unassigned',
      value: Math.round(Number(row.totalSecs) / 60),
    }));

    //  9. Activity-type distribution for pie chart
    const activityDistribution = Object.entries(statsGlobal)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({ key, value }));

    return {
      stats: {
        ...statsGlobal,
        xpTotal: totalXp,
        totalTimeSpent,
        avgTime,
        activeUsers: activeUserIds.size,
      },
      dailyTrend,
      courseBreakdown,
      activityDistribution,
    };
  }

  //  Paginated Live Activity Feed

  async getLiveFeed(
    page: number,
    limit: number,
    startDate: Date,
    endDate: Date,
    role?: string,
    keyword?: string,
  ) {
    const where: any = {
      createdAt: { gte: startDate, lte: endDate },
    };

    let roleUserIds: number[] | null = null;
    if (role && role !== 'ALL') {
      const matchingUsers = await this.mainPrisma.user.findMany({
        where: { userType: role as any },
        select: { id: true },
      });
      roleUserIds = matchingUsers.map((u) => u.id);
      if (roleUserIds.length === 0) {
        return { data: [], total: 0 };
      }
    }

    if (keyword) {
      const userWhere: any = {
        OR: [{ name: { contains: keyword } }, { email: { contains: keyword } }],
      };
      if (roleUserIds) {
        userWhere.id = { in: roleUserIds };
      }
      const matchedUsers = await this.mainPrisma.user.findMany({
        where: userWhere,
        select: { id: true },
      });
      const matchedUserIds = matchedUsers.map((u) => u.id);

      const matchedCourses = await this.mainPrisma.course.findMany({
        where: { title: { contains: keyword } },
        select: { id: true },
      });
      const matchedCourseIds = matchedCourses.map((c) => c.id);

      const matchedLessons = await this.mainPrisma.lesson.findMany({
        where: { title: { contains: keyword } },
        select: { id: true },
      });
      const matchedLessonIds = matchedLessons.map((l) => l.id);

      const orConditions: any[] = [];
      if (matchedUserIds.length > 0) {
        orConditions.push({ userId: { in: matchedUserIds } });
      }
      if (matchedCourseIds.length > 0) {
        const cond: any = { courseId: { in: matchedCourseIds } };
        if (roleUserIds) {
          cond.userId = { in: roleUserIds };
        }
        orConditions.push(cond);
      }
      if (matchedLessonIds.length > 0) {
        const cond: any = { lessonId: { in: matchedLessonIds } };
        if (roleUserIds) {
          cond.userId = { in: roleUserIds };
        }
        orConditions.push(cond);
      }

      if (orConditions.length === 0) {
        return { data: [], total: 0 };
      }
      where.OR = orConditions;
    } else {
      if (roleUserIds) {
        where.userId = { in: roleUserIds };
      }
    }

    const skip = (page - 1) * limit;
    const [feedLogs, total] = await Promise.all([
      this.prisma.userActivityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.userActivityLog.count({ where }),
    ]);

    if (feedLogs.length === 0) {
      return { data: [], total: 0 };
    }

    const allUserIds = [...new Set(feedLogs.map((l) => l.userId))];
    const allCourseIds = [
      ...new Set(feedLogs.map((l) => l.courseId).filter(Boolean) as number[]),
    ];
    const feedLessonIds = [
      ...new Set(feedLogs.map((l) => l.lessonId).filter(Boolean) as number[]),
    ];
    const feedQuizIds = [
      ...new Set(feedLogs.map((l) => l.quizId).filter(Boolean) as number[]),
    ];
    const feedPaymentIds = [
      ...new Set(feedLogs.map((l) => l.paymentId).filter(Boolean) as number[]),
    ];

    const [users, courses, lessons, quizzes, payments] = await Promise.all([
      this.mainPrisma.user.findMany({
        where: { id: { in: allUserIds } },
        select: { id: true, name: true, email: true, userType: true },
      }),
      this.mainPrisma.course.findMany({
        where: { id: { in: allCourseIds.length ? allCourseIds : [-1] } },
        select: { id: true, title: true },
      }),
      this.mainPrisma.lesson.findMany({
        where: { id: { in: feedLessonIds.length ? feedLessonIds : [-1] } },
        select: { id: true, title: true },
      }),
      this.mainPrisma.quiz.findMany({
        where: { id: { in: feedQuizIds.length ? feedQuizIds : [-1] } },
        select: { id: true, title: true },
      }),
      this.mainPrisma.payment.findMany({
        where: { id: { in: feedPaymentIds.length ? feedPaymentIds : [-1] } },
        select: { id: true, amount: true },
      }),
    ]);

    type UserInfo = {
      id: number;
      name: string;
      email: string;
      userType: string;
    };
    const userMap = users.reduce<Map<number, UserInfo>>((m, u) => {
      m.set(u.id, u as UserInfo);
      return m;
    }, new Map());
    const courseMap = courses.reduce<Map<number, string>>((m, c) => {
      m.set(c.id, c.title);
      return m;
    }, new Map());
    const lessonMap = lessons.reduce<Map<number, string>>((m, l) => {
      m.set(l.id, l.title);
      return m;
    }, new Map());
    const quizMap = quizzes.reduce<Map<number, string>>((m, q) => {
      m.set(q.id, q.title);
      return m;
    }, new Map());
    const paymentMap = payments.reduce<Map<number, number>>((m, p) => {
      m.set(p.id, Number(p.amount));
      return m;
    }, new Map());

    const data = feedLogs.map((log) => {
      const u = userMap.get(log.userId);
      const courseTitle = log.courseId
        ? (courseMap.get(log.courseId) ?? null)
        : null;
      const lessonTitle = log.lessonId
        ? (lessonMap.get(log.lessonId) ?? null)
        : null;
      const quizTitle = log.quizId ? (quizMap.get(log.quizId) ?? null) : null;
      const amount = log.paymentId ? (paymentMap.get(log.paymentId) ?? 0) : 0;
      return {
        id: String(log.id),
        userId: log.userId,
        userName: u?.name ?? `User #${log.userId}`,
        userRole: u?.userType ?? 'STUDENT',
        userEmail: u?.email ?? '',
        action: log.action,
        category: categorize(log.action),
        courseTitle,
        lessonTitle,
        quizTitle,
        xpPoints: log.xpPoints ?? 0,
        amount,
        createdAt: log.createdAt.toISOString(),
      };
    });

    return { data, total };
  }

  // Helper for computing active user aggregates
  private async compileUserAggregates(
    startDate: Date,
    endDate: Date,
    role?: string,
    keyword?: string,
  ) {
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const activeUserIdsFromLogs = await this.prisma.userActivityLog.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      select: { userId: true },
      distinct: ['userId'],
    });

    const activeUserIdsFromTime = await this.prisma.$queryRaw<
      Array<{ userId: number }>
    >`
      SELECT DISTINCT userId FROM user_time_spent
      WHERE date >= ${startStr} AND date <= ${endStr}
    `;

    const allActiveUserIds = Array.from(
      new Set([
        ...activeUserIdsFromLogs.map((l) => l.userId),
        ...activeUserIdsFromTime.map((t) => t.userId),
      ]),
    );

    if (allActiveUserIds.length === 0) {
      return [];
    }

    const userWhere: any = {
      id: { in: allActiveUserIds },
    };
    if (role && role !== 'ALL') {
      userWhere.userType = role as any;
    }
    if (keyword) {
      userWhere.OR = [
        { name: { contains: keyword } },
        { email: { contains: keyword } },
      ];
    }

    const matchedUsers = await this.mainPrisma.user.findMany({
      where: userWhere,
      select: { id: true, name: true, email: true, userType: true },
    });

    if (matchedUsers.length === 0) {
      return [];
    }

    const matchedUserIds = matchedUsers.map((u) => u.id);
    const matchedUserMap = new Map(matchedUsers.map((u) => [u.id, u]));

    const timeSpentRows = await this.prisma.$queryRaw<
      Array<{ userId: number; totalSecs: bigint }>
    >`
      SELECT userId, SUM(seconds) as totalSecs
      FROM user_time_spent
      WHERE date >= ${startStr} AND date <= ${endStr} AND userId IN (${Prisma.join(matchedUserIds)})
      GROUP BY userId
    `;
    const timeSpentMap = new Map(
      timeSpentRows.map((r) => [r.userId, Number(r.totalSecs)]),
    );

    const rawCounts = await this.prisma.userActivityLog.groupBy({
      by: ['action', 'userId'],
      _count: { id: true },
      _sum: { xpPoints: true },
      _max: { createdAt: true },
      where: {
        userId: { in: matchedUserIds },
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    return matchedUserIds.map((userId) => {
      const u = matchedUserMap.get(userId)!;
      const userLogs = rawCounts.filter((r) => r.userId === userId);
      const agg = {
        userId,
        name: u.name ?? `User #${userId}`,
        role: u.userType ?? 'STUDENT',
        email: u.email ?? '',
        logins: 0,
        exams: 0,
        lessons: 0,
        enrolls: 0,
        certs: 0,
        purchases: 0,
        shopCartVisits: 0,
        xp: 0,
        timeSpent: timeSpentMap.get(userId) ?? 0,
        lastActive: '',
      };
      for (const row of userLogs) {
        const cnt = Number(row._count.id);
        const cat = categorize(row.action);
        if (cat === 'login') agg.logins += cnt;
        if (cat === 'exam') agg.exams += cnt;
        if (cat === 'lesson') agg.lessons += cnt;
        if (cat === 'enroll') agg.enrolls += cnt;
        if (cat === 'certificate') agg.certs += cnt;
        if (cat === 'purchase') agg.purchases += cnt;
        if (cat === 'shop_cart') agg.shopCartVisits += cnt;
        agg.xp += Number(row._sum.xpPoints ?? 0);
        const maxAt = row._max.createdAt?.toISOString() ?? '';
        if (maxAt > agg.lastActive) agg.lastActive = maxAt;
      }
      return agg;
    });
  }

  //  Paginated User Leaderboard

  async getUserLeaderboard(
    page: number,
    limit: number,
    startDate: Date,
    endDate: Date,
    role?: string,
    keyword?: string,
  ) {
    const userAggregates = await this.compileUserAggregates(
      startDate,
      endDate,
      role,
      keyword,
    );
    if (userAggregates.length === 0) {
      return { data: [], total: 0 };
    }
    userAggregates.sort((a, b) => b.timeSpent - a.timeSpent);
    const total = userAggregates.length;
    const paginatedData = userAggregates.slice(
      (page - 1) * limit,
      page * limit,
    );
    return { data: paginatedData, total };
  }

  //  Paginated Stat Drilldown

  async getDrilldown(
    statKey: string,
    page: number,
    limit: number,
    startDate: Date,
    endDate: Date,
    role?: string,
    keyword?: string,
  ) {
    const userAggregates = await this.compileUserAggregates(
      startDate,
      endDate,
      role,
      keyword,
    );
    if (userAggregates.length === 0) {
      return { data: [], total: 0 };
    }

    const KEY_FIELD: Record<string, string> = {
      login: 'logins',
      lesson: 'lessons',
      exam: 'exams',
      enroll: 'enrolls',
      certificate: 'certs',
      purchase: 'purchases',
      shop_cart: 'shopCartVisits',
      xp: 'xp',
      avg: 'timeSpent',
    };

    const sortField = KEY_FIELD[statKey] ?? 'timeSpent';
    const filteredAggs = userAggregates.filter((agg) => {
      const val = (agg as any)[sortField];
      return val > 0;
    });

    filteredAggs.sort(
      (a, b) =>
        Number((b as any)[sortField] ?? 0) - Number((a as any)[sortField] ?? 0),
    );

    const total = filteredAggs.length;
    const paginatedData = filteredAggs.slice((page - 1) * limit, page * limit);
    return { data: paginatedData, total };
  }

  //  Single User Aggregated Stats

  async getUserStats(userId: number, startDate: Date, endDate: Date) {
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const timeSpentRow = await this.prisma.$queryRaw<
      Array<{ totalSecs: bigint }>
    >`
      SELECT SUM(seconds) as totalSecs
      FROM user_time_spent
      WHERE userId = ${userId} AND date >= ${startStr} AND date <= ${endStr}
    `;
    const timeSpent = timeSpentRow[0]?.totalSecs
      ? Number(timeSpentRow[0].totalSecs)
      : 0;

    const u = await this.mainPrisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, userType: true },
    });

    if (!u) {
      throw new Error('User not found');
    }

    const rawCounts = await this.prisma.userActivityLog.groupBy({
      by: ['action'],
      _count: { id: true },
      _sum: { xpPoints: true },
      _max: { createdAt: true },
      where: {
        userId,
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const agg = {
      userId,
      name: u.name ?? `User #${userId}`,
      role: u.userType ?? 'STUDENT',
      email: u.email ?? '',
      logins: 0,
      exams: 0,
      lessons: 0,
      enrolls: 0,
      certs: 0,
      purchases: 0,
      shopCartVisits: 0,
      xp: 0,
      timeSpent,
      lastActive: '',
    };

    for (const row of rawCounts) {
      const cnt = Number(row._count.id);
      const cat = categorize(row.action);
      if (cat === 'login') agg.logins += cnt;
      if (cat === 'exam') agg.exams += cnt;
      if (cat === 'lesson') agg.lessons += cnt;
      if (cat === 'enroll') agg.enrolls += cnt;
      if (cat === 'certificate') agg.certs += cnt;
      if (cat === 'purchase') agg.purchases += cnt;
      if (cat === 'shop_cart') agg.shopCartVisits += cnt;
      agg.xp += Number(row._sum.xpPoints ?? 0);
      const maxAt = row._max.createdAt?.toISOString() ?? '';
      if (maxAt > agg.lastActive) agg.lastActive = maxAt;
    }

    return agg;
  }

  //  Paginated Single User Timeline

  async getUserTimeline(
    userId: number,
    page: number,
    limit: number,
    startDate: Date,
    endDate: Date,
    category?: string,
  ) {
    let actionList: any[] = [];
    if (category && category !== 'ALL') {
      const mapped = Object.entries(ACTION_CATEGORY)
        .filter(([_, cat]) => cat === category)
        .map(([action]) => action.replace(/ /g, '_'));
      actionList = [...new Set(mapped)].filter(
        (action) => action in ActivityAction,
      );
    }

    const where: any = {
      userId,
      createdAt: { gte: startDate, lte: endDate },
    };

    if (actionList.length > 0) {
      where.action = { in: actionList };
    } else if (category && category !== 'ALL') {
      const mappedActions = Object.keys(ACTION_CATEGORY)
        .map((action) => action.replace(/ /g, '_'))
        .filter((action) => action in ActivityAction);
      where.action = { notIn: [...new Set(mappedActions)] };
    }

    const skip = (page - 1) * limit;
    const [feedLogs, total] = await Promise.all([
      this.prisma.userActivityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.userActivityLog.count({ where }),
    ]);

    if (feedLogs.length === 0) {
      return { data: [], total: 0 };
    }

    const allCourseIds = [
      ...new Set(feedLogs.map((l) => l.courseId).filter(Boolean) as number[]),
    ];
    const feedLessonIds = [
      ...new Set(feedLogs.map((l) => l.lessonId).filter(Boolean) as number[]),
    ];
    const feedQuizIds = [
      ...new Set(feedLogs.map((l) => l.quizId).filter(Boolean) as number[]),
    ];
    const feedPaymentIds = [
      ...new Set(feedLogs.map((l) => l.paymentId).filter(Boolean) as number[]),
    ];

    const [users, courses, lessons, quizzes, payments] = await Promise.all([
      this.mainPrisma.user.findMany({
        where: { id: userId },
        select: { id: true, name: true, email: true, userType: true },
      }),
      this.mainPrisma.course.findMany({
        where: { id: { in: allCourseIds.length ? allCourseIds : [-1] } },
        select: { id: true, title: true },
      }),
      this.mainPrisma.lesson.findMany({
        where: { id: { in: feedLessonIds.length ? feedLessonIds : [-1] } },
        select: { id: true, title: true },
      }),
      this.mainPrisma.quiz.findMany({
        where: { id: { in: feedQuizIds.length ? feedQuizIds : [-1] } },
        select: { id: true, title: true },
      }),
      this.mainPrisma.payment.findMany({
        where: { id: { in: feedPaymentIds.length ? feedPaymentIds : [-1] } },
        select: { id: true, amount: true },
      }),
    ]);

    type UserInfo = {
      id: number;
      name: string;
      email: string;
      userType: string;
    };
    const userMap = users.reduce<Map<number, UserInfo>>((m, u) => {
      m.set(u.id, u as UserInfo);
      return m;
    }, new Map());
    const courseMap = courses.reduce<Map<number, string>>((m, c) => {
      m.set(c.id, c.title);
      return m;
    }, new Map());
    const lessonMap = lessons.reduce<Map<number, string>>((m, l) => {
      m.set(l.id, l.title);
      return m;
    }, new Map());
    const quizMap = quizzes.reduce<Map<number, string>>((m, q) => {
      m.set(q.id, q.title);
      return m;
    }, new Map());
    const paymentMap = payments.reduce<Map<number, number>>((m, p) => {
      m.set(p.id, Number(p.amount));
      return m;
    }, new Map());

    const data = feedLogs.map((log) => {
      const u = userMap.get(log.userId);
      const courseTitle = log.courseId
        ? (courseMap.get(log.courseId) ?? null)
        : null;
      const lessonTitle = log.lessonId
        ? (lessonMap.get(log.lessonId) ?? null)
        : null;
      const quizTitle = log.quizId ? (quizMap.get(log.quizId) ?? null) : null;
      const amount = log.paymentId ? (paymentMap.get(log.paymentId) ?? 0) : 0;
      return {
        id: String(log.id),
        userId: log.userId,
        userName: u?.name ?? `User #${log.userId}`,
        userRole: u?.userType ?? 'STUDENT',
        userEmail: u?.email ?? '',
        action: log.action,
        category: categorize(log.action),
        courseTitle,
        lessonTitle,
        quizTitle,
        xpPoints: log.xpPoints ?? 0,
        amount,
        createdAt: log.createdAt.toISOString(),
      };
    });

    return { data, total };
  }
}
