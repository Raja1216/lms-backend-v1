import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  Request as NestjsRequest,
  Res,
  Next,
  Put,
  Query,
} from '@nestjs/common';
import { ProjectGradingService } from './project-grading.service';
import { ManualGradeDto, RubricGradeDto } from './dto/grading.dto';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { PermissionGuard } from 'src/guard/permission.guard';
import { Permissions } from 'src/guard/premission.decorator';
import { successResponse } from 'src/utils/success-response';
import { User } from 'src/generated/prisma/client';
import { Response, NextFunction } from 'express';
import { ErrorHandler } from 'src/utils/error-handler';
import { CoursePerformanceQueryDto } from './dto/grading.dto';
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('project-grading')
export class ProjectGradingController {
  constructor(private readonly projectGradingService: ProjectGradingService) {}
  @Permissions('create-grades')
  @Post(':submissionId/manual')
  async gradeManual(
    @Param('submissionId', ParseIntPipe) submissionId: number,
    @Body() dto: ManualGradeDto,
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestjsRequest() req: { user: User },
  ) {
    try {
      const userId = req.user.id;
      const data = await this.projectGradingService.gradeManual(
        submissionId,
        dto,
        userId,
      );
      return successResponse(
        res,
        200,
        'Submission graded successfully',
        data,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
          error?.status ? error.status : 500,
        ),
      );
    }
  }
  @Permissions('create-grades')
  @Post(':submissionId/rubric')
  async gradeRubric(
    @Param('submissionId', ParseIntPipe) submissionId: number,
    @Body() dto: RubricGradeDto,
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestjsRequest() req: { user: User },
  ) {
    try {
      const userId = req.user.id;
      const data = await this.projectGradingService.gradeRubric(
        submissionId,
        dto,
        userId,
      );
      return successResponse(
        res,
        200,
        'Submission graded successfully',
        data,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
          error?.status ? error.status : 500,
        ),
      );
    }
  }

  @Permissions('update-grades')
  @Put(':submissionId/publish')
  async publishGrade(
    @Param('submissionId', ParseIntPipe) submissionId: number,
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestjsRequest() req: { user: User },
  ) {
    try {
      const userId = req.user.id;
      await this.projectGradingService.publishGrade(submissionId, userId);
      return successResponse(
        res,
        200,
        'Grade published successfully',
        null,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
          error?.status ? error.status : 500,
        ),
      );
    }
  }

  @Permissions('read-grades')
  @Get(':submissionId')
  async getGrade(
    @Param('submissionId', ParseIntPipe) submissionId: number,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const data = await this.projectGradingService.getGrade(submissionId);
      return successResponse(res, 200, 'Grade fetched', data, null);
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
          error?.status ? error.status : 500,
        ),
      );
    }
  }

  @Get(':submissionId/my')
  async getMyGrade(
    @Param('submissionId', ParseIntPipe) submissionId: number,
    @NestjsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const studentId = req.user.id;
      const data = await this.projectGradingService.getMyGrade(
        submissionId,
        studentId,
      );
      return successResponse(res, 200, 'Your grade', data, null);
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
          error?.status ? error.status : 500,
        ),
      );
    }
  }
  @Permissions('read-grades')
  @Get('project/:projectId/grades')
  async listByProject(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const data =
        await this.projectGradingService.listGradesByProject(projectId);
      return successResponse(res, 200, 'Grades fetched', data, null);
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
          error?.status ? error.status : 500,
        ),
      );
    }
  }
  @Permissions('read-grades')
  @Get('performance/course')
  async getCoursePerformance(
    @Query() query: CoursePerformanceQueryDto,
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestjsRequest() req: { user: User },
  ) {
    try {
      const data = await this.projectGradingService.getCoursePerformance(
        query.courseId,
        query.studentId,
      );
      return successResponse(res, 200, 'Course performance', data, null);
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
          error?.status ? error.status : 500,
        ),
      );
    }
  }
}
