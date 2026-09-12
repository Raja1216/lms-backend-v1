import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Res,
  Next,
} from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { CertificateTemplateService } from './certificate-template.service';
import {
  CreateCertificateTemplateDto,
  UpdateCertificateTemplateDto,
  PreviewCertificateTemplateDto,
  AssignCourseTemplateDto,
  CertificateTemplateQueryDto,
} from './dto/certificate-template.dto';
import { successResponse } from 'src/utils/success-response';
import { ErrorHandler } from 'src/utils/error-handler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createPagedResponse } from 'src/shared/create-paged-response';

@ApiTags('Admin Certificate Templates')
@ApiBearerAuth('access-token')
@Controller('admin/certificate-templates')
export class AdminCertificateTemplateController {
  constructor(
    private readonly templateService: CertificateTemplateService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getAllTemplates(
    @Query() query: CertificateTemplateQueryDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { data, total, page, limit } =
        await this.templateService.getAllTemplates(query);
      return successResponse(
        res,
        200,
        'Certificate templates retrieved successfully',
        createPagedResponse(data, page, limit, total),
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }


  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getTemplateById(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const template = await this.templateService.getTemplateById(id);
      return successResponse(
        res,
        200,
        'Certificate template retrieved successfully',
        template,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createTemplate(
    @Body() dto: CreateCertificateTemplateDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.templateService.createTemplate(dto);
      return successResponse(
        res,
        201,
        'Certificate template created successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async updateTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCertificateTemplateDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.templateService.updateTemplate(id, dto);
      return successResponse(
        res,
        200,
        'Certificate template updated successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.templateService.deleteTemplate(id);
      return successResponse(
        res,
        200,
        'Certificate template deleted successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/set-default')
  async setDefaultTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.templateService.setDefaultTemplate(id);
      return successResponse(
        res,
        200,
        'Default certificate template updated successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Put('assign-course')
  async assignCourseTemplate(
    @Body() dto: AssignCourseTemplateDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.templateService.assignCourseTemplate(dto);
      return successResponse(
        res,
        200,
        'Course certificate template updated successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('preview-pdf')
  async previewTemplatePdf(
    @Body() dto: PreviewCertificateTemplateDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const pdfBuffer = await this.templateService.previewTemplatePdf(dto);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="certificate-preview.pdf"',
        'Content-Length': pdfBuffer.length,
      });
      return res.end(pdfBuffer);
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'An unexpected error occurred',
          error.status || 500,
        ),
      );
    }
  }
}
