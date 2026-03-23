import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
  Res,
  Next,
  Request as NestJsRequest,
  Put,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { multerOptions } from '../../utils/multer.util';
import { ProjectSubmissionService } from './project-submission.service';
import {
  CreateSubmissionDto,
  UpdateSubmissionDto,
  QuerySubmissionsDto,
} from './dto/submission.dto';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { PermissionGuard } from 'src/guard/permission.guard';
import { successResponse } from 'src/utils/success-response';
import { Response, NextFunction } from 'express';
import { User } from 'src/generated/prisma/browser';
import { ErrorHandler } from 'src/utils/error-handler';
import { ApiConsumes } from '@nestjs/swagger';
import { createPagedResponse } from 'src/shared/create-paged-response';
import { Permissions } from 'src/guard/premission.decorator';
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('project-submission')
export class ProjectSubmissionController {
  constructor(
    private readonly projectSubmissionService: ProjectSubmissionService,
  ) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files', 10, multerOptions()))
  @ApiConsumes('multipart/form-data')
  async create(
    @Body() dto: CreateSubmissionDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestJsRequest() req: { user: User },
  ) {
    try {
      const result = await this.projectSubmissionService.createOrResubmit(
        dto,
        req?.user?.id,
        files,
      );
      return successResponse(
        res,
        201,
        'Submission created successfully',
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

  @Post('update/:id')
  @UseInterceptors(FilesInterceptor('files', 10, multerOptions()))
  @ApiConsumes('multipart/form-data')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubmissionDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestJsRequest() req: { user: User },
  ) {
    try {
      if (typeof (dto as any).links === 'string') {
        try {
          dto.links = JSON.parse((dto as any).links);
        } catch {
          dto.links = [];
        }
      }
      const data = await this.projectSubmissionService.updateSubmission(
        id,
        dto,
        req?.user?.id,
        files,
      );
      return successResponse(res, 200, 'Submission updated', data, null);
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @Permissions('project-submission-read')
  @Get()
  async findAll(
    @Query() query: QuerySubmissionsDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { data, page, limit, total } =
        await this.projectSubmissionService.findAll(query);
      return successResponse(
        res,
        200,
        'Submissions fetched',
        createPagedResponse(data, page, limit, total),
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

  @Get('my/:projectId')
  async findMySubmission(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestJsRequest() req: { user: User },
  ) {
    try {
      const data = await this.projectSubmissionService.findMySubmission(
        projectId,
        req?.user?.id,
      );
      return successResponse(res, 200, 'Your submission', data, null);
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @Permissions('project-submission-read')
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const data = await this.projectSubmissionService.findOne(id);
      return successResponse(res, 200, 'Submission fetched', data, null);
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @Permissions('review-project-submission')
  @Put(':id/review')
  async markUnderReview(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const data = await this.projectSubmissionService.markUnderReview(id);
      return successResponse(
        res,
        200,
        'Submission marked as under review',
        data,
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

  @Permissions('project-submission-read')
  @Get(':id/history')
  async getHistory(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const data = await this.projectSubmissionService.getHistory(id);
      return successResponse(res, 200, 'Submission history', data, null);
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @Delete(':id/files/:fileId')
  async removeFile(
    @Param('id', ParseIntPipe) submissionId: number,
    @Param('fileId', ParseIntPipe) fileId: number,
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestJsRequest() req: { user: User },
  ) {
    try {

      const data = await this.projectSubmissionService.removeFile(
        submissionId,
        fileId,
        req?.user?.id,
      );
      return successResponse(res, 200, 'File removed', data, null);
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
