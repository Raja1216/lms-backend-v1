import {
  Controller,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  Get,
  Res,
  Next,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ChapterService } from './chapter.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { PermissionGuard } from 'src/guard/permission.guard';
import { Permissions } from 'src/guard/premission.decorator';
import { Response, NextFunction } from 'express';
import { successResponse } from 'src/utils/success-response';
import { ErrorHandler } from 'src/utils/error-handler';
import { PaginationDto } from 'src/shared/dto/pagination-dto';
import { createPagedResponse } from 'src/shared/create-paged-response';
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('chapters')
export class ChapterController {
  constructor(private readonly chapterService: ChapterService) {}

  @Permissions('chapter-create')
  @Post()
  async create(
    @Body() dto: CreateChapterDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.chapterService.create(dto);
      return successResponse(res, 201, 'Chapter created successfully', result, null);
    } catch (error) {
      return next(new ErrorHandler(error.message, error.status || 500));
    }
  }
  @Permissions('chapter-read')
  @Get()
  async findAll(
    @Res() res: Response,
    @Next() next: NextFunction,
    @Query() PaginationDto: PaginationDto,
  ) {
    try {
      const {chapters, total, page, limit} = await this.chapterService.findAll(PaginationDto);
      return successResponse(res, 200, 'Chapters fetched successfully', createPagedResponse(chapters, page, limit, total), null);
    } catch (error) {
      return next(new ErrorHandler(error.message, error.status || 500));
    }
  }

  @Get('by-subject/:subjectId')
  async bySubject(
    @Param('subjectId') subjectId: number,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.chapterService.findBySubject(+subjectId);
      return successResponse(res, 200, 'Chapters fetched successfully', result, null);
    } catch (error) {
      return next(new ErrorHandler(error.message, error.status || 500));
    }
  }

  @Get('by-module/:moduleId')
  async byModule(
    @Param('moduleId') moduleId: number,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.chapterService.findByModule(+moduleId);
      return successResponse(res, 200, 'Chapters fetched successfully', result, null);
    } catch (error) {
      return next(new ErrorHandler(error.message, error.status || 500));
    }
  }

  @Get('slug/:slug')
  async bySlug(
    @Param('slug') slug: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.chapterService.findBySlug(slug);
      return successResponse(res, 200, 'Chapter fetched successfully', result, null);
    } catch (error) {
      return next(new ErrorHandler(error.message, error.status || 500));
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: number,
    @Body() dto: UpdateChapterDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.chapterService.update(+id, dto);
      return successResponse(res, 200, 'Chapter updated successfully', result, null);
    } catch (error) {
      return next(new ErrorHandler(error.message, error.status || 500));
    }
  }

  @Delete(':id')
  async remove(
    @Param('id') id: number,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.chapterService.remove(+id);
      return successResponse(res, 200, 'Chapter deleted successfully', result, null);
    } catch (error) {
      return next(new ErrorHandler(error.message, error.status || 500));
    }
  }
}
