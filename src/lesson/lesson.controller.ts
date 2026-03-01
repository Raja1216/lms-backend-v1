import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  Res,
  Next,
  ConflictException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { LessonService } from './lesson.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { Request, Response, NextFunction } from 'express';
import { successResponse } from 'src/utils/success-response';
import { ErrorHandler } from 'src/utils/error-handler';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { PermissionGuard } from 'src/guard/permission.guard';
import { Permissions } from 'src/guard/premission.decorator';
import { ChapterService } from 'src/chapter/chapter.service';
import { User } from 'src/generated/prisma/browser';
import { generateUniqueSlugForTable } from 'src/shared/generate-unique-slug-for-table';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('lesson')
export class LessonController {
  constructor(
    private readonly lessonService: LessonService,
    private readonly chapterService: ChapterService,
  ) {}

  @Permissions('lesson-create')
  @Post()
  async create(
    @Body() createLessonDto: CreateLessonDto,
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { title, chapterIds } = createLessonDto;
      const isLessonExist = await this.lessonService.findLessonByTitle(title);
      if (isLessonExist) {
        throw new ConflictException('Lesson with this title already exists');
      }
      if (chapterIds && chapterIds.length > 0) {
        for (const chapterId of chapterIds) {
          const chapter = await this.chapterService.findOne(chapterId);
          if (!chapter) {
            throw new NotFoundException(`Some Invalid Chapter  are selected`);
          }
        }
      }

      const result = await this.lessonService.create(createLessonDto);
      return successResponse(
        res,
        201,
        'Lesson created successfully',
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
    return this.lessonService.findAll();
  }

  @Permissions('lesson-read')
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const lesson = await this.lessonService.findOne(+id);
      if (!lesson) {
        throw new NotFoundException('Lesson not found');
      }
      return successResponse(
        res,
        200,
        'Lesson fetched successfully',
        lesson,
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

  // @Permissions('lesson-read')
  @Get('/by-chapter/:chapterId')
  async findByChapter(
    @Param('chapterId') chapterId: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      // validate chapter exists
      await this.chapterService.findOne(+chapterId);

      const result = await this.lessonService.findByChapter(+chapterId);

      // optional: flatten response
      const lessons = result.map((item) => item.lesson);

      return successResponse(
        res,
        200,
        'Lessons fetched successfully',
        lessons,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ?? 500,
        ),
      );
    }
  }

  @Permissions('lesson-update')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateLessonDto: UpdateLessonDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { title, chapterIds } = updateLessonDto;
      if (title) {
        const isLessonExist = await this.lessonService.findLessonByTitle(
          title,
          +id,
        );
        if (isLessonExist) {
          throw new ConflictException('Lesson with this title already exists');
        }
      }
      if (chapterIds && chapterIds.length > 0) {
        for (const chapterId of chapterIds) {
          const chapter = await this.chapterService.findOne(chapterId);
          if (!chapter) {
            throw new NotFoundException(`Some Invalid Chapter  are selected`);
          }
        }
      }
      const result = await this.lessonService.update(+id, updateLessonDto);
      return successResponse(
        res,
        200,
        'Lesson updated successfully',
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

  @Get('/slug/:slug')
  async findBySlug(
    @Param('slug') slug: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const lesson = await this.lessonService.findBySlug(slug);
      if (!lesson) {
        throw new NotFoundException('Lesson not found');
      }
      return successResponse(
        res,
        200,
        'Lesson fetched successfully',
        lesson,
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

  @Permissions('lesson-update')
  @Patch('/status/:id')
  async updateStatus(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.lessonService.updateStatus(+id);
      return successResponse(
        res,
        200,
        'Lesson status updated successfully',
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
    return this.lessonService.remove(+id);
  }

  @Post('/complete/:lessonId')
  async completeLesson(
    @Param('lessonId') lessonId: number,
    @Req() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.lessonService.completeLesson(
        lessonId,
        req.user,
      );
      return successResponse(
        res,
        200,
        'Lesson marked as complete successfully',
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
}
