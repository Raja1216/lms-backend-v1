import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Res,
  Next,
} from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { User } from 'src/generated/prisma/client';
import { successResponse } from 'src/utils/success-response';
import { Response, NextFunction } from 'express';
import { ErrorHandler } from 'src/utils/error-handler';

@UseGuards(JwtAuthGuard)
@Controller('activity-log')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Post()
  async logActivity(
    @Body() body: { action: string; courseId?: number },
    @Request() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.activityLogService.logActivity(
        req.user.id,
        body.action,
        body.courseId ? Number(body.courseId) : undefined,
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
    @Body() body: { seconds: number },
    @Request() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const seconds = Number(body.seconds ?? 0);
      if (seconds > 0) {
        await this.activityLogService.recordTimeSpent(req.user.id, seconds);
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
}
