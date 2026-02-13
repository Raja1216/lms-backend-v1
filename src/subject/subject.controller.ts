import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Next,
  Req,
  Res,
  ConflictException,
  NotFoundException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { SubjectService } from './subject.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { Request, Response, NextFunction } from 'express';
import { successResponse } from 'src/utils/success-response';
import { CourseService } from 'src/course/course.service';
import { ErrorHandler } from 'src/utils/error-handler';
import { PermissionGuard } from 'src/guard/permission.guard';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { Permissions } from 'src/guard/premission.decorator';
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('subject')
export class SubjectController {
  constructor(
    private readonly subjectService: SubjectService,
    private readonly courseService: CourseService,
  ) {}

  @Permissions('create-subject')
  @Post()
  async create(
    @Body() createSubjectDto: CreateSubjectDto,
    @Res() res: Response,
    @Req() req: Request,
    @Next() next: NextFunction,
  ) {
    try {
      const { name, courseIds } = createSubjectDto;
      const isSubjectExist = await this.subjectService.findSubjectByName(name);
      if (isSubjectExist) {
        throw new ConflictException('Subject with this name already exists');
      }
      for (const courseId of courseIds) {
        const course = await this.courseService.findOne(courseId);
        if (!course) {
          throw new NotFoundException('Course not found');
        }
      }
      const result = await this.subjectService.create(createSubjectDto);
      return successResponse(
        res,
        201,
        'Subject created successfully',
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

  @Get('by-course/:courseId')
  async subjectsByCourseId(
    @Param('courseId') courseId: number,
    @Res() res: Response,
    @Req() req: Request,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.subjectService.subjectsByCourseId(courseId);
      return successResponse(
        res,
        200,
        'Subjects fetched successfully',
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
  findAll() {
    return this.subjectService.findAll();
  }

  @Permissions('read-subject')
  @Get('by-id/:id')
  async findOne(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.subjectService.findOne(+id);
      return successResponse(
        res,
        200,
        'Subject fetched successfully',
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
  @Get('slug/:slug')
  async findOneBySlug(
    @Param('slug') slug: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.subjectService.findOneBySlug(slug);
      return successResponse(
        res,
        200,
        'Subject fetched successfully',
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

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateSubjectDto: UpdateSubjectDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { name, courseIds } = updateSubjectDto;
      if (name) {
        const isSubjectExist = await this.subjectService.findSubjectByName(
          name,
          +id,
        );
        if (isSubjectExist) {
          throw new ConflictException('Subject with this name already exists');
        }
      }
      if (courseIds && courseIds.length > 0) {
        for (const courseId of courseIds) {
          const course = await this.courseService.findOne(courseId);
          if (!course) {
            throw new NotFoundException('Course not found');
          }
        }
      }
      const result = this.subjectService.update(+id, updateSubjectDto);
      return successResponse(
        res,
        200,
        'Subject updated successfully',
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

  @Patch('status/:id')
  async updateStatus(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.subjectService.updateStatus(+id);
      return successResponse(
        res,
        200,
        'Subject status updated successfully',
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
    return this.subjectService.remove(+id);
  }
}
