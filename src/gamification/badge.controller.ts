import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from 'src/generated/prisma/browser';

import { BadgeService } from './services/badge.service';

import { CreateBadgeDto } from './dto/create-badge.dto';
import { UpdateBadgeDto } from './dto/update-badge.dto';
import { ListBadgeDto } from './dto/list-badge.dto';

import { PermissionGuard } from '../guard/permission.guard';
import { Permissions } from '../guard/premission.decorator';

@ApiTags('Badge Admin')
@ApiBearerAuth('access-token')
@Controller('badge')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class BadgeController {
  constructor(private readonly badgeService: BadgeService) {}

  /**
   * GET /badge
   */
  @Get()
  @Permissions('badges-read')
  async findAll(@Query() query: ListBadgeDto) {
    const data = await this.badgeService.listBadgesAdmin(query);

    return {
      status: true,
      data,
    };
  }

  /**
   * GET /badge/course-status/:courseId
   */
  @Get('course-status/:courseId')
  async getCourseRewardsStatus(
    @Param('courseId') courseId: string,
    @Req() req: { user: User },
  ) {
    const data = await this.badgeService.getCourseRewardsStatus(
      courseId,
      req.user.id,
    );

    return {
      status: true,
      data,
    };
  }

  /**
   * GET /badge/target/course/:id
   */
  @Get('target/course/:id')
  @Permissions('badges-read')
  async getCourseTargetHierarchy(@Param('id', ParseIntPipe) id: number) {
    const data = await this.badgeService.getCourseTargetHierarchy(id);

    return {
      status: true,
      data,
    };
  }

  /**
   * GET /badge/target/subject/:id
   */
  @Get('target/subject/:id')
  @Permissions('badges-read')
  async getSubjectTargetHierarchy(@Param('id', ParseIntPipe) id: number) {
    const data = await this.badgeService.getSubjectTargetHierarchy(id);

    return {
      status: true,
      data,
    };
  }

  /**
   * GET /badge/target/module/:id
   */
  @Get('target/module/:id')
  @Permissions('badges-read')
  async getModuleTargetHierarchy(@Param('id', ParseIntPipe) id: number) {
    const data = await this.badgeService.getModuleTargetHierarchy(id);

    return {
      status: true,
      data,
    };
  }

  /**
   * GET /badge/target/chapter/:id
   */
  @Get('target/chapter/:id')
  @Permissions('badges-read')
  async getChapterTargetHierarchy(@Param('id', ParseIntPipe) id: number) {
    const data = await this.badgeService.getChapterTargetHierarchy(id);

    return {
      status: true,
      data,
    };
  }

  /**
   * GET /badge/target/lesson/:id
   */
  @Get('target/lesson/:id')
  @Permissions('badges-read')
  async getLessonTargetHierarchy(@Param('id', ParseIntPipe) id: number) {
    const data = await this.badgeService.getLessonTargetHierarchy(id);

    return {
      status: true,
      data,
    };
  }

  /**
   * GET /badge/target/quiz/:id
   */
  @Get('target/quiz/:id')
  @Permissions('badges-read')
  async getQuizTargetHierarchy(@Param('id', ParseIntPipe) id: number) {
    const data = await this.badgeService.getQuizTargetHierarchy(id);

    return {
      status: true,
      data,
    };
  }

  /**
   * GET /badge/target/resolve?trigger=...&targetId=...
   */
  @Get('target/resolve')
  @Permissions('badges-read')
  async resolveTargetHierarchy(
    @Query('trigger') trigger: string,
    @Query('targetId') targetId: string,
  ) {
    const data = await this.badgeService.resolveTargetHierarchy(
      trigger,
      targetId,
    );

    return {
      status: true,
      data,
    };
  }

  /**
   * GET /badge/:id
   */
  @Get(':id')
  @Permissions('badges-read')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const data = await this.badgeService.getBadgeById(id);

    return {
      status: true,
      data,
    };
  }

  /**
   * POST /badge
   */
  @Post()
  @Permissions('badges-create')
  async create(@Body() dto: CreateBadgeDto) {
    const data = await this.badgeService.createBadgeAdmin(dto);

    return {
      status: true,
      data,
    };
  }

  /**
   * PATCH /badge/:id
   */
  @Patch(':id')
  @Permissions('badges-update')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBadgeDto,
  ) {
    const data = await this.badgeService.updateBadgeAdmin(id, dto);

    return {
      status: true,
      data,
    };
  }

  /**
   * DELETE /badge/:id
   */
  @Delete(':id')
  @Permissions('badges-delete')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.badgeService.deleteBadgeAdmin(id);

    return {
      status: true,
      message: 'Badge deleted',
    };
  }
}
