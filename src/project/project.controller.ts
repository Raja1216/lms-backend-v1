import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Res,
  Next,
  UseGuards,
  Request as NestJsRequest,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectDto } from './dto/query-project.dto';
import { successResponse } from 'src/utils/success-response';
import { ErrorHandler } from 'src/utils/error-handler';
import { Response, NextFunction } from 'express';
import { createPagedResponse } from 'src/shared/create-paged-response';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { PermissionGuard } from 'src/guard/permission.guard';
import { Permissions } from 'src/guard/premission.decorator';
import { User } from 'src/generated/prisma/browser';
import { UpsertGradeScaleDto } from './dto/grade-scale.dto';
import { PaginationDto } from 'src/shared/dto/pagination-dto';
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('project')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}
  @Permissions('project-create')
  @Post()
  async create(
    @NestJsRequest() req: { user: User },
    @Body() createProjectDto: CreateProjectDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.projectService.create(
        createProjectDto,
        req.user.id,
      );
      return successResponse(
        res,
        201,
        'Project created successfully',
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

  @Permissions('project-read')
  @Get()
  async findAll(
    @NestJsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
    @Query() query: QueryProjectDto,
  ) {
    try {
      const { data, page, limit, total } =
        await this.projectService.findAll(query);
      return successResponse(
        res,
        200,
        'Projects retrieved successfully',
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
  @Get('course/:courseSlug')
  async findProjectsByCourseSlug(
    @Param('courseSlug') courseSlug: string,
    @Query() paginationDto: PaginationDto,
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestJsRequest() req: { user: User },
  ) {
    try {
      const { data, page, limit, total } =
        await this.projectService.findProjectsByCourseSlug(
          courseSlug,
          req.user.id,
          paginationDto,
        );
      return successResponse(
        res,
        200,
        'Projects retrieved successfully',
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
  @Permissions('project-read')
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.projectService.findOne(+id);
      return successResponse(
        res,
        200,
        'Project retrieved successfully',
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
  @Permissions('project-update')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @NestJsRequest() req: { user: User },
    @Body() updateProjectDto: UpdateProjectDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.projectService.update(
        +id,
        updateProjectDto,
        req.user.id,
      );
      return successResponse(
        res,
        200,
        'Project updated successfully',
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
  @Permissions('project-delete')
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @NestJsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.projectService.remove(+id, req.user.id);
      return successResponse(
        res,
        200,
        'Project deleted successfully',
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
  @Permissions('grade-scale-manage')
  @Post('grade-scale/:courseId')
  async upsertGradeScale(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: UpsertGradeScaleDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const data = await this.projectService.upsertGradeScale(
        courseId,
        body.bands,
      );
      return successResponse(res, 200, 'Grade scale saved', data, null);
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }
  @Permissions('grade-scale-manage')
  @Get('grade-scale/:courseId')
  async getGradeScale(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const data = await this.projectService.getGradeScale(courseId);
      return successResponse(res, 200, 'Grade scale fetched', data, null);
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
