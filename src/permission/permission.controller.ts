import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Res,
  Query,
  Next,
} from '@nestjs/common';
import { PermissionService } from './permission.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PermissionGuard } from 'src/guard/permission.guard';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { Permissions } from 'src/guard/premission.decorator';
import { Response, NextFunction } from 'express';
import { successResponse } from 'src/utils/success-response';
import { ErrorHandler } from 'src/utils/error-handler';
import { PaginationDto } from 'src/shared/dto/pagination-dto';
import { createPagedResponse, PagedResponse } from 'src/shared/create-paged-response';

@Controller('permission')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('create-permissions')
  @Post()
  async create(
    @Body() createPermissionDto: CreatePermissionDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const permissions =
        await this.permissionService.create(createPermissionDto);
      return successResponse(
        res,
        201,
        'Permissions created successfully',
        permissions,
        {},
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('read-permissions')
  @Get()
  async findAll(
    @Res() res: Response,
    @Query() paginationDto: PaginationDto,
    @Next() next: NextFunction,
  ) {
    try {
      const {permission, total} = await this.permissionService.findAll(paginationDto);
      const pagedResponse: PagedResponse<any> = createPagedResponse(
        permission,
        paginationDto.page || 1,
        paginationDto.limit || 10,
        total,
      );

      return successResponse(
        res,
        200,
        'Permissions retrieved successfully',
        pagedResponse,
        {},
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('read-permissions')
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const permission = await this.permissionService.findOne(+id);
      return successResponse(
        res,
        200,
        'Permission retrieved successfully',
        permission,
        {},
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('update-permissions')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updatePermissionDto: UpdatePermissionDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const permission = await this.permissionService.update(
        +id,
        updatePermissionDto,
      );
      return successResponse(
        res,
        200,
        'Permission updated successfully',
        permission,
        {},
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          500,
        ),
      );
    }
  }
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('delete-permissions')
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const permission = await this.permissionService.remove(+id);
      return successResponse(
        res,
        200,
        'Permission deleted successfully',
        permission,
        {},
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          500,
        ),
      );
    }
  }
}
