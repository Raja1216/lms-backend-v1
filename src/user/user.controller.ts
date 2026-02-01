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

  @Get('me/full-profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get full profile with XP and level' })
  async fullProfile(
    @Request() req,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const profile = await this.svc.getUserProfile(req.user.id);
      return successResponse(
        res,
        200,
        'Profile retrieved successfully',
        profile,
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

  @Get('me/badges')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get user badges' })
  async getBadges(
    @Request() req,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const badges = await this.svc.getUserBadges(req.user.id);
      return successResponse(
        res,
        200,
        'Badges retrieved successfully',
        badges,
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

  @Get('me/certificates')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get user certificates' })
  async getCertificates(
    @Request() req,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const certificates = await this.svc.getUserCertificates(req.user.id);
      return successResponse(
        res,
        200,
        'Certificates retrieved successfully',
        certificates,
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

  @Get('me/leaderboard/:courseId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get leaderboard for a course' })
  async getLeaderboard(
    @Param('courseId') courseId: string,
    @Request() req,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const leaderboard = await this.svc.getUserLeaderboard(
        req.user.id,
        Number(courseId),
      );
      return successResponse(
        res,
        200,
        'Leaderboard retrieved successfully',
        leaderboard,
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

  @Get('me/performance-report')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get user performance report' })
  async getPerformanceReport(
    @Request() req,
    @Res() res: Response,
    @Next() next: NextFunction,
    @Query('courseId') courseId?: string,
  ) {
    try {
      const report = await this.svc.getUserPerformanceReport(
        req.user.id,
        courseId ? Number(courseId) : undefined,
      );
      return successResponse(
        res,
        200,
        'Performance report retrieved successfully',
        report,
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

  @Get('me/xp-history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get user XP history' })
  async getXPHistory(
    @Request() req,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const profile = await this.svc.getUserProfile(req.user.id);
      const xpHistory = profile.xpEarned.map((xp) => ({
        id: xp.id,
        amount: xp.xpPoints,
        reason: xp.lesson
          ? `Completed lesson: ${xp.lesson.title}`
          : xp.quiz
            ? `Completed quiz: ${xp.quiz.title}`
            : 'XP earned',
        date: xp.createdAt,
      }));
      return successResponse(
        res,
        200,
        'XP history retrieved successfully',
        xpHistory,
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
}
