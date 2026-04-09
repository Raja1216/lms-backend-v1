import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  Next,
  UseGuards,
  Request as NestJsRequest,
} from '@nestjs/common';
import { ReportService } from './report.service';
import { GetReportDto } from './dto/get-report.dto';
import { NextFunction } from 'express';
import { User } from 'src/generated/prisma/browser';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { PermissionGuard } from 'src/guard/permission.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
@ApiTags('Report')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get(':courseSlug')
  async getReport(
    @Param('courseSlug') courseSlug: string,
    @NestJsRequest() req: { user: User },
  ) {
    return this.reportService.getReport(courseSlug, req.user.id);
  }
}
