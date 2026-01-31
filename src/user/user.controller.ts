// src/user/user.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
  Patch,
  Res,
  Next,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { UpdateUserDto } from './dto/update-user.dto';
import { PermissionGuard } from 'src/guard/permission.guard';
import { Permissions } from 'src/guard/premission.decorator';
import { successResponse } from 'src/utils/success-response';
import { ErrorHandler } from 'src/utils/error-handler';
import { Response, NextFunction } from 'express';
import { PaginationDto } from 'src/shared/dto/pagination-dto';
import { createPagedResponse } from 'src/shared/create-paged-response';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly svc: UserService) {}

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('create-users')
  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created' })
  async create(
    @Body() body: CreateUserDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const user = await this.svc.createUser(
        body.email,
        body.password,
        body.name,
        body.level,
        body.roles,
      );
      return successResponse(res, 201, 'User created successfully', user, null);
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
  @Permissions('update-users')
  @Patch(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update user by id (protected)' })
  @ApiResponse({ status: 200, description: 'User updated' })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const user = await this.svc.updateUser(Number(id), body);
      return successResponse(res, 200, 'User updated successfully', user, null);
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          500,
        ),
      );
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'List of users' })
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('read-users')
  @ApiBearerAuth('access-token')
  async getAll(
    @Query() paginationDto: PaginationDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { users, total } = await this.svc.findAll(paginationDto);
      const pagedResponse = createPagedResponse(
        users,
        paginationDto.page ?? 1,
        paginationDto.limit ?? 10,
        total,
      );
      return successResponse(
        res,
        200,
        'Users retrieved successfully',
        pagedResponse,
        null,
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

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('read-users')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get user by id (protected)' })
  @ApiResponse({ status: 200, description: 'User found' })
  async get(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const user = await this.svc.findById(Number(id));
      return successResponse(res, 200, 'User found successfully', user, null);
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          500,
        ),
      );
    }
  }

  // optional: a 'me' endpoint using the validated user from JwtStrategy
  @Get('me/profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current logged in user' })
  async profile(@Request() req) {
    // req.user is set by JwtStrategy.validate()
    return req.user;
  }
}
