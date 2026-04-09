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

@Controller('report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get(':courseSlug')
  async getReport(
    @Param('courseSlug') courseSlug: string,
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestJsRequest() req: { user: User },
  ) {
    return this.reportService.getReport(courseSlug, req.user.id);
  }
}
