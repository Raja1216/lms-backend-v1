import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Res,
  Next,
  Query,
  Param,
} from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { PermissionGuard } from 'src/guard/permission.guard';
import { Permissions } from 'src/guard/premission.decorator';
import { User } from 'src/generated/prisma/client';
import { successResponse } from 'src/utils/success-response';
import { Response, NextFunction } from 'express';
import { ErrorHandler } from 'src/utils/error-handler';
import { PaginationDto } from 'src/shared/dto/pagination-dto';
import { createPagedResponse } from 'src/shared/create-paged-response';
import { AdminActivityQueryDto } from './dto/admin-activity-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('activity-log')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Post()
  async logActivity(
    @Body()
    body: {
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
    },
    @Request() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.activityLogService.logActivity(
        req.user.id,
        body.action,
        body.courseId ? Number(body.courseId) : undefined,
        {
          quizSubmissionId: body.quizSubmissionId
            ? Number(body.quizSubmissionId)
            : undefined,
          projectSumissionId: body.projectSumissionId
            ? Number(body.projectSumissionId)
            : undefined,
          lessonId: body.lessonId ? Number(body.lessonId) : undefined,
          assigmentSumissionId: body.assigmentSumissionId
            ? Number(body.assigmentSumissionId)
            : undefined,
          paymentId: body.paymentId ? Number(body.paymentId) : undefined,
          quizId: body.quizId ? Number(body.quizId) : undefined,
          productId: body.productId ? Number(body.productId) : undefined,
          xpPoints: body.xpPoints ? Number(body.xpPoints) : undefined,
        },
      );
      return successResponse(
        res,
        200,
        'Activity logged successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ?? 500,
        ),
      );
    }
  }

  @Post('time-spent')
  async logTimeSpent(
    @Body() body: { seconds: number; courseId?: number },
    @Request() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const seconds = Number(body.seconds ?? 0);
      if (seconds > 0) {
        await this.activityLogService.recordTimeSpent(
          req.user.id,
          seconds,
          body.courseId ? Number(body.courseId) : undefined,
        );
      }
      return successResponse(
        res,
        200,
        'Time spent tracked successfully',
        null,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ?? 500,
        ),
      );
    }
  }

  @Get('streak')
  async getStreak(
    @Request() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const streak = await this.activityLogService.getDailyStreak(req.user.id);
      return successResponse(
        res,
        200,
        'Daily streak fetched successfully',
        { streak },
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ?? 500,
        ),
      );
    }
  }

  @UseGuards(PermissionGuard)
  @Permissions('read-users')
  @Get('admin/dashboard')
  async getAdminDashboard(
    @Res() res: Response,
    @Next() next: NextFunction,
    @Query() query: AdminActivityQueryDto,
  ) {
    try {
      const now = new Date();
      const startDate = query.startDate
        ? new Date(query.startDate)
        : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const endDate = query.endDate ? new Date(query.endDate) : now;

      const result = await this.activityLogService.getAdminDashboard(
        startDate,
        endDate,
        query.role || undefined,
        query.keyword || undefined,
      );
      return successResponse(
        res,
        200,
        'Admin activity dashboard fetched successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ?? 500,
        ),
      );
    }
  }

  @UseGuards(PermissionGuard)
  @Permissions('read-users')
  @Get('admin/feed')
  async getLiveFeed(
    @Res() res: Response,
    @Next() next: NextFunction,
    @Query() query: AdminActivityQueryDto,
  ) {
    try {
      const now = new Date();
      const startDate = query.startDate
        ? new Date(query.startDate)
        : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const endDate = query.endDate ? new Date(query.endDate) : now;
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 10);
      const role = query.role;
      const keyword = query.keyword;

      const result = await this.activityLogService.getLiveFeed(
        page,
        limit,
        startDate,
        endDate,
        role || undefined,
        keyword || undefined,
      );

      return successResponse(
        res,
        200,
        'Live activity feed fetched successfully',
        createPagedResponse(result.data, page, limit, result.total),
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ?? 500,
        ),
      );
    }
  }

  @UseGuards(PermissionGuard)
  @Permissions('read-users')
  @Get('admin/leaderboard')
  async getUserLeaderboard(
    @Res() res: Response,
    @Next() next: NextFunction,
    @Query() query: AdminActivityQueryDto,
  ) {
    try {
      const now = new Date();
      const startDate = query.startDate
        ? new Date(query.startDate)
        : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const endDate = query.endDate ? new Date(query.endDate) : now;
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 10);
      const role = query.role;
      const keyword = query.keyword;

      const result = await this.activityLogService.getUserLeaderboard(
        page,
        limit,
        startDate,
        endDate,
        role || undefined,
        keyword || undefined,
      );

      return successResponse(
        res,
        200,
        'User leaderboard fetched successfully',
        createPagedResponse(result.data, page, limit, result.total),
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ?? 500,
        ),
      );
    }
  }

  @UseGuards(PermissionGuard)
  @Permissions('read-users')
  @Get('admin/drilldown')
  async getDrilldown(
    @Res() res: Response,
    @Next() next: NextFunction,
    @Query() query: AdminActivityQueryDto,
  ) {
    try {
      const now = new Date();
      const startDate = query.startDate
        ? new Date(query.startDate)
        : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const endDate = query.endDate ? new Date(query.endDate) : now;
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 10);
      const role = query.role;
      const keyword = query.keyword;
      const statKey = query.statKey;

      const result = await this.activityLogService.getDrilldown(
        statKey || 'timeSpent',
        page,
        limit,
        startDate,
        endDate,
        role || undefined,
        keyword || undefined,
      );

      return successResponse(
        res,
        200,
        'Drilldown data fetched successfully',
        createPagedResponse(result.data, page, limit, result.total),
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ?? 500,
        ),
      );
    }
  }

  @UseGuards(PermissionGuard)
  @Permissions('read-users')
  @Get('admin/users/:userId/stats')
  async getUserStats(
    @Param('userId') userIdStr: string,
    @Res() res: Response,
    @Next() next: NextFunction,
    @Query() query: AdminActivityQueryDto,
  ) {
    try {
      const now = new Date();
      const startDate = query.startDate
        ? new Date(query.startDate)
        : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const endDate = query.endDate ? new Date(query.endDate) : now;
      const userId = Number(userIdStr);

      const result = await this.activityLogService.getUserStats(
        userId,
        startDate,
        endDate,
      );

      return successResponse(
        res,
        200,
        'User timeline stats fetched successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ?? 500,
        ),
      );
    }
  }

  @UseGuards(PermissionGuard)
  @Permissions('read-users')
  @Get('admin/users/:userId/timeline')
  async getUserTimeline(
    @Param('userId') userIdStr: string,
    @Res() res: Response,
    @Next() next: NextFunction,
    @Query() query: AdminActivityQueryDto,
  ) {
    try {
      const now = new Date();
      const startDate = query.startDate
        ? new Date(query.startDate)
        : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const endDate = query.endDate ? new Date(query.endDate) : now;
      const userId = Number(userIdStr);
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 10);
      const category = query.category;

      const result = await this.activityLogService.getUserTimeline(
        userId,
        page,
        limit,
        startDate,
        endDate,
        category,
      );

      return successResponse(
        res,
        200,
        'User timeline fetched successfully',
        createPagedResponse(result.data, page, limit, result.total),
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ?? 500,
        ),
      );
    }
  }
}
