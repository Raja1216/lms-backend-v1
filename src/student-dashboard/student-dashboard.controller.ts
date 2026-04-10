import {
  Controller,
  Res,
  Next,
  Get,
  Request as NestjsRequest,
  Param,
  UseGuards,
} from '@nestjs/common';
import { StudentDashboardService } from './student-dashboard.service';
import { Response, NextFunction } from 'express';
import { User } from 'src/generated/prisma/client';
import { successResponse } from 'src/utils/success-response';
import { ErrorHandler } from 'src/utils/error-handler';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
@UseGuards(JwtAuthGuard)
@Controller('student-dashboard')
export class StudentDashboardController {
  constructor(
    private readonly studentDashboardService: StudentDashboardService,
  ) {}
  @Get('/analytics/:courseId')
  async getStudentAnalytics(
    @Param('courseId') courseId: string,
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestjsRequest() req: { user: User },
  ) {
    try {
      const analytics = await this.studentDashboardService.getStudentAnalytics(
        req.user.id,
        parseInt(courseId),
      );
      return successResponse(
        res,
        200,
        'Analytics fetched successfully',
        analytics,
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
