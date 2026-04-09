import { Controller, Get, Param, Query } from '@nestjs/common';
import { ReportService } from './report.service';
import { GetReportDto } from './dto/get-report.dto';

@Controller('report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get(':courseSlug')
  async getReport(
    @Param('courseSlug') courseSlug: string,
    @Query() query: GetReportDto,
  ) {
    return this.reportService.getReport(courseSlug);
  }
}