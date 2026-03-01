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
  Next,
  Query,
  Catch,
  Put,
} from '@nestjs/common';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PermissionGuard } from 'src/guard/permission.guard';
import { Permissions } from 'src/guard/premission.decorator';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { successResponse } from 'src/utils/success-response';
import { ErrorHandler } from 'src/utils/error-handler';
import { Response, NextFunction } from 'express';
import { PaginationDto } from 'src/shared/dto/pagination-dto';
import { createPagedResponse } from 'src/shared/create-paged-response';
import { NestApplication } from '@nestjs/core';

@Controller('role')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('create-roles')
  @Post()
  async create(
    @Body() createRoleDto: CreateRoleDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const role = await this.roleService.create(createRoleDto);
      return successResponse(res, 201, 'Role created successfully', role, {});
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
  @Permissions('read-roles')
  @Get()
  async findAll(
    @Res() res: Response,
    @Query() paginationDto: PaginationDto,
    @Next() next: NextFunction,
  ) {
    try {
      const { roles, total } = await this.roleService.findAll(paginationDto);
      const pagedRoles = createPagedResponse(
        roles,
        paginationDto.limit ?? 10,
        paginationDto.page ?? 1,
        total,
      );
      return successResponse(
        res,
        200,
        'Roles fetched successfully',
        pagedRoles,
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
  @Permissions('read-roles')
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const role = await this.roleService.findOne(+id);
      return successResponse(res, 200, 'Role fetched successfully', role, {});
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
  @Permissions('update-roles')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const role = await this.roleService.update(+id, updateRoleDto);
      return successResponse(res, 200, 'Role updated successfully', role, {});
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
  @Permissions('update-roles')
  @Put('reload-super-admin')
  async reloadSuperAdmin(@Res() res: Response, @Next() next: NextFunction) {
    try {
      const role = await this.roleService.reloadSuperAdmin();
      return successResponse(
        res,
        200,
        'Super Admin role reloaded successfully',
        role,
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
  @Permissions('delete-roles')
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const role = await this.roleService.remove(+id);
      return successResponse(res, 200, 'Role deleted successfully', role, {});
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
