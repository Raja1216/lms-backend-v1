import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Res,
  Req,
  Next,
  ConflictException,
  NotFoundException,
  BadRequestException,
  UseGuards,
  Query,
} from '@nestjs/common';
import { CourseService } from './course.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { successResponse } from 'src/utils/success-response';
import { ErrorHandler } from 'src/utils/error-handler';
import { Request, Response, NextFunction } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { Permissions } from 'src/guard/premission.decorator';
import { PermissionGuard } from 'src/guard/permission.guard';
import { UserService } from 'src/user/user.service';
import { PaginationDto } from 'src/shared/dto/pagination-dto';
import { createPagedResponse } from 'src/shared/create-paged-response';
import { get } from 'http';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('course')
export class CourseController {
  constructor(
    private readonly courseService: CourseService,
    private readonly userService: UserService,
  ) {}

  @Permissions('create-course')
  @Post()
  async create(
    @Body() createCourseDto: CreateCourseDto,
    @Res() res: Response,
    @Req() req: Request,
    @Next() next: NextFunction,
  ) {
    try {
      const { title, teacherIds } = createCourseDto;
      const isCourseExist = await this.courseService.findCourseByName(title);
      if (isCourseExist) {
        throw new ConflictException('Course with this title already exists');
      }
      for (const teacherId of teacherIds) {
        const teacher = await this.userService.findById(teacherId);
        if (!teacher) {
          throw new NotFoundException('Teacher not found');
        }
        if (!teacher.roles.some((role) => role.name === 'teacher')) {
          throw new BadRequestException('User is not assigned as a teacher');
        }
      }
      const result = await this.courseService.create(createCourseDto);
      return successResponse(
        res,
        201,
        'Course created successfully',
        result,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @Get()
  async findAll(
    @Query() paginationDto: PaginationDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { data, total } = await this.courseService.findAll(paginationDto);
      const pagedResponse = createPagedResponse(
        data,
        paginationDto.page ?? 1,
        paginationDto.limit ?? 10,
        total,
      );
      return successResponse(
        res,
        200,
        'Courses fetched successfully',
        pagedResponse,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @Permissions('read-course')
  @Get('by-id/:id')
  async findOne(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.courseService.findOne(+id);
      return successResponse(
        res,
        200,
        'Course fetched successfully',
        result,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @Permissions('update-course')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateCourseDto: UpdateCourseDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { title, teacherIds } = updateCourseDto;
      if (title) {
        const isCourseExist = await this.courseService.findCourseByName(
          title,
          +id,
        );
        if (isCourseExist) {
          throw new ConflictException('Course with this title already exists');
        }
      }
      if (teacherIds) {
        for (const teacherId of teacherIds) {
          const teacher = await this.userService.findById(teacherId);
          if (!teacher) {
            throw new NotFoundException('Teacher not found');
          }
          if (!teacher.roles.some((role) => role.name === 'teacher')) {
            throw new BadRequestException('User is not assigned as a teacher');
          }
        }
      }
      const result = await this.courseService.update(+id, updateCourseDto);
      return successResponse(
        res,
        200,
        'Course updated successfully',
        result,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @Permissions('update-course')
  @Patch(':id/status')
  async updateCourseStatus(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.courseService.updateStatus(+id);
      return successResponse(
        res,
        200,
        'Course status updated successfully',
        result,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @Get(':slug')
  async findCourseBySlug(
    @Param('slug') slug: string,
    @Next() next: NextFunction,
    @Res() res: Response,
  ) {
    try {
      const result = await this.courseService.findCourseBySlug(slug);
      return successResponse(
        res,
        200,
        'Course fetched successfully',
        result,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.courseService.remove(+id);
  }
}
