import {
  Body,
  Controller,
  Delete,
  Get,
  Next,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';

import { NextFunction, Response } from 'express';

import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';

import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { PermissionGuard } from 'src/guard/permission.guard';
import { Permissions } from 'src/guard/premission.decorator';

import { successResponse } from 'src/utils/success-response';
import { ErrorHandler } from 'src/utils/error-handler';
import { createPagedResponse } from 'src/shared/create-paged-response';


@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('category-create')
  @Post()
  async create(
    @Body() dto: CreateCategoryDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.categoryService.create(dto);

      return successResponse(
        res,
        201,
        'Category created successfully',
        result,
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

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('category-read')
  @Get()
  async findAll(
    @Query() query: CategoryQueryDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { data, total } = await this.categoryService.findAll(query);

      const result = createPagedResponse(
        data,
        query.page ?? 1,
        query.limit ?? 10,
        total,
      );

      return successResponse(
        res,
        200,
        'Categories fetched successfully',
        result,
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

  @Permissions('category-read')
  @Get('options')
  async options(@Res() res: Response, @Next() next: NextFunction) {
    try {
      const result = await this.categoryService.getOptions();

      return successResponse(
        res,
        200,
        'Category options fetched successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(new ErrorHandler(error.message, error.status ?? 500));
    }
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('category-read')
  @Get('tree')
  async tree(@Res() res: Response, @Next() next: NextFunction) {
    try {
      const result = await this.categoryService.getTree();

      return successResponse(
        res,
        200,
        'Category tree fetched successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(new ErrorHandler(error.message, error.status ?? 500));
    }
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('category-read')
  @Get('by-id/:id')
  async findOne(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.categoryService.findOne(+id);

      return successResponse(
        res,
        200,
        'Category fetched successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(new ErrorHandler(error.message, error.status ?? 500));
    }
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('category-update')
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.categoryService.updateStatus(+id);

      return successResponse(
        res,
        200,
        'Category status updated successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(new ErrorHandler(error.message, error.status ?? 500));
    }
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('category-update')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.categoryService.update(+id, dto);

      return successResponse(
        res,
        200,
        'Category updated successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(new ErrorHandler(error.message, error.status ?? 500));
    }
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('category-delete')
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      await this.categoryService.remove(+id);

      return successResponse(
        res,
        200,
        'Category removed successfully',
        null,
        null,
      );
    } catch (error: any) {
      return next(new ErrorHandler(error.message, error.status ?? 500));
    }
  }
}
