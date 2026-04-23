import {
  Controller,
  Res,
  Request as NestJsRequest,
  Next,
  UseGuards,
  Get,
  Post,
  Delete,
  Param,
  ParseIntPipe,
  Body,
  Query,
} from '@nestjs/common';
import { CourseManagementService } from './course-management.service';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { PermissionGuard } from 'src/guard/permission.guard';
import { Permissions } from 'src/guard/premission.decorator';
import { successResponse } from 'src/utils/success-response';
import { ErrorHandler } from 'src/utils/error-handler';
import { Response, NextFunction } from 'express';
import { User } from 'src/generated/prisma/browser';
import { AssignCourseDto } from './dto/assign-course.dto';
import { EnrollStudentDto } from './dto/enroll-student.dto';
import { AssignTeacherToCourseDto } from './dto/assign-teacher-course.dto';
import { PaginationDto } from 'src/shared/dto/pagination-dto';
import { createPagedResponse } from 'src/shared/create-paged-response';
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('institution/course-management')
export class CourseManagementController {
  constructor(
    private readonly courseManagementService: CourseManagementService,
  ) {}

  @Permissions('course-read')
  @Get(':id/courses')
  async getCourses(
    @Param('id') institutionId: number,
    @NestJsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
    @Query() paginationDto: PaginationDto,
  ) {
    try {
      const { courses, page, limit, total } =
        await this.courseManagementService.getInstitutionCourses(
          institutionId,
          req.user.id,
          paginationDto,
        );
      const pagedResponse = createPagedResponse(courses, page, limit, total);
      return successResponse(
        res,
        200,
        'Courses retrieved successfully',
        pagedResponse,
        null,
      );
    } catch (error: any) {
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

  @Permissions('institution-course-assign-create')
  @Post(':id/assign-courses')
  async assignCourse(
    @Param('id', ParseIntPipe) id: number,
    @NestJsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
    @Body() dto: AssignCourseDto,
  ) {
    try {
      const result = await this.courseManagementService.assignCourse(
        id,
        req.user.id,
        dto,
      );
      return successResponse(
        res,
        200,
        'Course assigned successfully',
        result,
        null,
      );
    } catch (error: any) {
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
  @Permissions('institution-course-assign-update')
  async removeCourse(
    @Param('id', ParseIntPipe) id: number,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestJsRequest() req: { user: User },
  ) {
    try {
      const result = await this.courseManagementService.removeCourse(
        id,
        courseId,
        req.user.id,
      );
      return successResponse(
        res,
        200,
        'Course removed successfully',
        result,
        null,
      );
    } catch (error: any) {
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
  @Permissions('institution-course-enrollment-create')
  @Post(':id/enroll')
  async enrollStudents(
    @Param('id', ParseIntPipe) id: number,
    @NestJsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
    @Body() dto: EnrollStudentDto,
  ) {
    try {
      const result = await this.courseManagementService.enrollStudents(
        id,
        req.user.id,
        dto,
      );
      return successResponse(
        res,
        200,
        'Students enrolled successfully',
        result,
        null,
      );
    } catch (error: any) {
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

  @Permissions('institution-course-enrollment-update')
  @Delete(':id/courses/:courseId/students/:studentId')
  async unenrollStudent(
    @Param('id', ParseIntPipe) id: number,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('studentId', ParseIntPipe) studentId: number,
    @NestJsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.courseManagementService.unenrollStudent(
        id,
        courseId,
        studentId,
        req.user.id,
      );
      return successResponse(
        res,
        200,
        'Student unenrolled successfully',
        result,
        null,
      );
    } catch (error: any) {
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
  @Permissions('institution-course-assign-create')
  @Post(':id/assign-teachers')
  async assignTeachers(
    @Param('id', ParseIntPipe) id: number,
    @NestJsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
    @Body() dto: AssignTeacherToCourseDto,
  ) {
    try {
      const result = await this.courseManagementService.assignTeachersToCourse(
        id,
        req.user.id,
        dto,
      );
      return successResponse(
        res,
        200,
        'Teachers assigned successfully',
        result,
        null,
      );
    } catch (error: any) {
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
  @Permissions('institution-course-assign-update')
  @Delete(':id/courses/:courseId/teachers/:teacherId')
  async removeTeacher(
    @Param('id', ParseIntPipe) id: number,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('teacherId', ParseIntPipe) teacherId: number,
    @NestJsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.courseManagementService.removeTeacherFromCourse(
        id,
        courseId,
        teacherId,
        req.user.id,
      );
      return successResponse(
        res,
        200,
        'Teacher removed successfully',
        result,
        null,
      );
    } catch (error: any) {
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
  @Get('teacher/students')
  async getTeacherStudents(
    @NestJsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
    @Query() paginationDto: PaginationDto,
  ) {
    try {
      const result = await this.courseManagementService.getTeacherStudents(
        req.user.id,
        paginationDto,
      );
      // const pagedResponse = createPagedResponse(data, page, limit, total);
      return successResponse(
        res,
        200,
        'Students retrieved successfully',
        result,
        null,
      );
    } catch (error: any) {
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

  @Get('teacher/projects/:projectId/submissions')
  async getTeacherSubmissions(
    @NestJsRequest() req: { user: User },
    @Param('projectId', ParseIntPipe) projectId: number,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.courseManagementService.getTeacherSubmissions(
        req.user.id,
        projectId,
      );
      return successResponse(
        res,
        200,
        'Submissions retrieved successfully',
        result,
        null,
      );
    } catch (error: any) {
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
