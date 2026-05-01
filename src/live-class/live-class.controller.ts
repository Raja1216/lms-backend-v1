import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  Res,
  Next,
  Patch,
  UseGuards,
} from '@nestjs/common';

import { Response, NextFunction } from 'express';

import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { PermissionGuard } from 'src/guard/permission.guard';

import { successResponse } from 'src/utils/success-response';
import { ErrorHandler } from 'src/utils/error-handler';
import { Permissions } from 'src/guard/premission.decorator';
import { LiveClassService } from './live-class.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('live-classes')
export class LiveClassController {
  constructor(private service: LiveClassService) {}

  @Permissions('live-class-create')
  @Post()
  async create(@Body() dto, @Req() req, @Res() res, @Next() next) {
    try {
      const result = await this.service.create(dto, req.user);

      return successResponse(res, 201, 'Live class created', result, null);
    } catch (e) {
      return next(new ErrorHandler(e.message, e.status ?? 500));
    }
  }

  @Permissions('live-class-read')
  @Get()
  async findAll(@Query() q, @Req() req, @Res() res, @Next() next) {
    try {
      const result = await this.service.findAll(q, req.user);

      return successResponse(res, 200, 'Success', result.data, {
        total: result.total,
        page: result.page,
        limit: result.limit,
      });
    } catch (e) {
      return next(new ErrorHandler(e.message, e.status ?? 500));
    }
  }

  @Permissions('live-class-read')
  @Get(':id')
  async findOne(@Param('id') id, @Req() req, @Res() res, @Next() next) {
    try {
      const result = await this.service.findOne(id, req.user);

      return successResponse(res, 200, 'Success', result, null);
    } catch (e) {
      return next(new ErrorHandler(e.message, e.status ?? 500));
    }
  }

  @Permissions('live-class-start')
  @Patch(':id/start')
  async start(@Param('id') id, @Req() req, @Res() res, @Next() next) {
    try {
      const result = await this.service.start(id, req.user);

      return successResponse(res, 200, 'Class started', result, null);
    } catch (e) {
      return next(new ErrorHandler(e.message, e.status ?? 500));
    }
  }

  @Permissions('live-class-end')
  @Patch(':id/end')
  async end(@Param('id') id, @Res() res) {
    const result = await this.service.end(id);
    return successResponse(res, 200, 'Class ended', result, null);
  }

  @Permissions('live-class-join')
  @Post(':id/join')
  async join(@Param('id') id, @Req() req, @Res() res) {
    const result = await this.service.join(id, req.user);
    return successResponse(res, 200, 'Joined', result, null);
  }
}