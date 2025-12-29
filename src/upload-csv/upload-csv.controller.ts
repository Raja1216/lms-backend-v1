import { UploadCsvService } from './upload-csv.service';
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  Res,
  BadRequestException,
  HttpStatus,
  ParseFilePipe,
  MaxFileSizeValidator,
  Next,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response, NextFunction } from 'express';
import {
  CsvEntityType,
  CsvImportDto,
  CsvUploadDto,
} from './dto/csv-upload.dto';
import { successResponse } from 'src/utils/success-response';
import { ErrorHandler } from 'src/utils/error-handler';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { PermissionGuard } from 'src/guard/permission.guard';
import { Permissions } from 'src/guard/premission.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions('upload-csv')
@Controller('upload-csv')
export class UploadCsvController {
  constructor(private readonly uploadCsvService: UploadCsvService) {}

  @Permissions('read-csv-template')
  @Get('template')
  async downloadTemplate(
    @Query('entityType') entityType: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      // Validate entity type
      if (!Object.values(CsvEntityType).includes(entityType as CsvEntityType)) {
        throw new BadRequestException(
          `Invalid entity type. Must be one of: ${Object.values(CsvEntityType).join(', ')}`,
        );
      }

      const csvBuffer = await this.uploadCsvService.generateTemplate(
        entityType as CsvEntityType,
      );
      const filename = `${entityType}_template_${Date.now()}.csv`;

      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': csvBuffer.length,
      });

      res.send(csvBuffer);
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @Permissions('create-upload-csv')
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAndPreview(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @Body('entityType') entityType: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    // Validate file type
    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('Only CSV files are allowed');
    }

    // Validate entity type
    if (!Object.values(CsvEntityType).includes(entityType as CsvEntityType)) {
      throw new BadRequestException(
        `Invalid entity type. Must be one of: ${Object.values(CsvEntityType).join(', ')}`,
      );
    }

    try {
      const preview = await this.uploadCsvService.parseAndPreview(
        file,
        entityType as CsvEntityType,
      );
      return successResponse(
        res,
        HttpStatus.OK,
        'CSV parsed and validated successfully',
        preview,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @Permissions('create-upload-csv')
  @Post('import')
  async importData(
    @Body('entityType') entityType: string,
    @Body('data') data: Record<string, any>[],
    @Body('updateExisting') updateExisting: boolean = false,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    // Validate entity type
    if (!Object.values(CsvEntityType).includes(entityType as CsvEntityType)) {
      throw new BadRequestException(
        `Invalid entity type. Must be one of: ${Object.values(CsvEntityType).join(', ')}`,
      );
    }

    // Validate data
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new BadRequestException('No data provided for import');
    }

    try {
      const result = await this.uploadCsvService.importData(
        entityType as CsvEntityType,
        data,
        updateExisting,
      );

      return successResponse(
        res,
        HttpStatus.OK,
        'Data imported successfully',
        result,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @Permissions('create-upload-csv')
  @Post('upload-and-import')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAndImport(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @Body('entityType') entityType: string,
    @Body('updateExisting') updateExisting: string = 'false',
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    // Validate file type
    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('Only CSV files are allowed');
    }

    // Validate entity type
    if (!Object.values(CsvEntityType).includes(entityType as CsvEntityType)) {
      throw new BadRequestException(
        `Invalid entity type. Must be one of: ${Object.values(CsvEntityType).join(', ')}`,
      );
    }

    try {
      //Parse and preview
      const preview = await this.uploadCsvService.parseAndPreview(
        file,
        entityType as CsvEntityType,
      );

      // Check for validation errors
      if (preview.invalidRows > 0) {
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: `CSV contains ${preview.invalidRows} invalid row(s). Please fix errors before importing.`,
          data: {
            preview,
            imported: false,
          },
        };
      }

      //  Import if no validation errors
      const result = await this.uploadCsvService.importData(
        entityType as CsvEntityType,
        preview.rows,
        updateExisting === 'true',
      );
      return successResponse(
        res,
        HttpStatus.OK,
        'CSV uploaded and imported successfully',
        result,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @Permissions('read-upload-csv')
  @Get('entity-types')
  getEntityTypes(@Res() res: Response, @Next() next: NextFunction) {
    try {
      return successResponse(
        res,
        HttpStatus.OK,
        'Available entity types',
        Object.values(CsvEntityType).map((type) => ({
          value: type,
          label: type.charAt(0).toUpperCase() + type.slice(1) + 's',
        })),
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @Permissions('read-upload-csv')
  @Get('health')
  healthCheck(@Res() res: Response, @Next() next: NextFunction) {
    try {
      return successResponse(
        res,
        HttpStatus.OK,
        'CSV import service is running',
        null,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }
}
