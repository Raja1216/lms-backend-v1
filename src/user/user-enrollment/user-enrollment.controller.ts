import {
  BadRequestException,
  Controller,
  Get,
  Next,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,

} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { NextFunction, Response } from 'express';
import { PaginationDto } from 'src/shared/dto/pagination-dto';
import { createPagedResponse } from 'src/shared/create-paged-response';
import { ErrorHandler } from 'src/utils/error-handler';
import { successResponse } from 'src/utils/success-response';
import { UserEnrollmentService } from './user-enrollment.service';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { PermissionGuard } from 'src/guard/permission.guard';
import { Permissions } from 'src/guard/premission.decorator';
import { permission } from 'process';
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller(['user-enrollment', 'user-enrollments'])
export class UserEnrollmentController {
  constructor(private readonly userEnrollmentService: UserEnrollmentService) {}

  @Permissions('read-users')
  @Get()
  async findAll(
    @Query() paginationDto: PaginationDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { enrollments, total, page, limit } =
        await this.userEnrollmentService.findAll(paginationDto);
      const pagedResponse = createPagedResponse(
        enrollments,
        page,
        limit,
        total,
      );

      return successResponse(
        res,
        200,
        'Enrollments retrieved successfully',
        pagedResponse,
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
  @Permissions('create-users')
  @Get('import/sample')
  async downloadSample(@Res() res: Response) {
    const buffer = await this.userEnrollmentService.generateSampleXlsx();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="course_enrollment_sample.xlsx"',
    });
    res.send(buffer);
  }
  @Permissions('create-users')
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importEnrollments(
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Enrollment import file is required');
    }

    const buffer = await this.userEnrollmentService.importEnrollmentsFromXlsx(
      file.buffer,
    );
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="enrollment_result_${Date.now()}.xlsx"`,
    });
    res.send(buffer);
  }
}
