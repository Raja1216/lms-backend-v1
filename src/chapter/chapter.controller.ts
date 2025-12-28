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
  UseGuards,
} from '@nestjs/common';
import { ChapterService } from './chapter.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { SubjectService } from 'src/subject/subject.service';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { PermissionGuard } from 'src/guard/permission.guard';
import { Permissions } from 'src/guard/premission.decorator';
import { successResponse } from 'src/utils/success-response';
import { Request, Response, NextFunction } from 'express';

import { ErrorHandler } from 'src/utils/error-handler';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('chapter')
export class ChapterController {
  constructor(
    private readonly chapterService: ChapterService,
    private readonly subjectService: SubjectService,
  ) {}

  @Permissions('create-chapter')
  @Post()
  async create(
    @Body() createChapterDto: CreateChapterDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { title, subjectIds } = createChapterDto;
      const isChapterExist =
        await this.chapterService.findChapterByTitle(title);
      if (isChapterExist) {
        throw new ConflictException('Chapter with this title already exists');
      }
      for (const subjectId of subjectIds) {
        const subject = await this.subjectService.findOne(subjectId);
        if (!subject) {
          throw new NotFoundException(`Some Invalid Subject are selected`);
        }
      }
      const result = await this.chapterService.create(createChapterDto);
      return successResponse(
        res,
        201,
        'Chapter created successfully',
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
    return this.chapterService.findAll();
  }

  @Permissions('read-chapter')
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const chapter = await this.chapterService.findOne(+id);
      if (!chapter) {
        throw new NotFoundException('Chapter not found');
      }
      return successResponse(
        res,
        200,
        'chapter details retrived successfully',
        chapter,
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
  async findBySlug(
    @Param('slug') slug: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const chapter = await this.chapterService.findBySlug(slug);
      if (!chapter) {
        throw new NotFoundException('Chapter not found');
      }
      return successResponse(
        res,
        200,
        'chapter details retrived successfully',
        chapter,
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

  @Permissions('update-chapter')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateChapterDto: UpdateChapterDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { title, subjectIds } = updateChapterDto;
      if (title) {
        this.chapterService.findChapterByTitle(title, +id).then((isExist) => {
          if (isExist) {
            throw new ConflictException(
              'Chapter with this title already exists',
            );
          }
        });
      }
      if (subjectIds && subjectIds.length > 0) {
        subjectIds.forEach(async (subjectId) => {
          const subject = await this.subjectService.findOne(subjectId);
          if (!subject) {
            throw new NotFoundException(`Some Invalid Subject are selected`);
          }
        });
      }
      const result = await this.chapterService.update(+id, updateChapterDto);

      return successResponse(
        res,
        200,
        'Chapter updated successfully',
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

  @Permissions('update-chapter')
  @Patch('status/:id')
  async updateStatus(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.chapterService.updateStatus(+id);

      return successResponse(
        res,
        200,
        'Chapter status updated successfully',
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
    return this.chapterService.remove(+id);
  }
}
