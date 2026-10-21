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
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

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
