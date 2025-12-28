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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import {
  CsvEntityType,
  CsvImportDto,
  CsvUploadDto,
} from './dto/csv-upload.dto';

@Controller('upload-csv')
export class UploadCsvController {
  constructor(private readonly uploadCsvService: UploadCsvService) {}
  /**
   * Download CSV template for specific entity type
   * GET /csv/template?entityType=course
   *
   * @example
   * GET http://localhost:3000/csv/template?entityType=course
   */
  @Get('template')
  async downloadTemplate(
    @Query('entityType') entityType: string,
    @Res() res: Response,
  ) {
    // Validate entity type
    if (!Object.values(CsvEntityType).includes(entityType as CsvEntityType)) {
      throw new BadRequestException(
        `Invalid entity type. Must be one of: ${Object.values(CsvEntityType).join(', ')}`,
      );
    }

    try {
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
      throw new BadRequestException(
        `Failed to generate template: ${error.message}`,
      );
    }
  }

  /**
   * Upload CSV file and get preview with validation
   * POST /csv/upload
   * Content-Type: multipart/form-data
   *
   * @example
   * POST http://localhost:3000/csv/upload
   * Body:
   *   - file: [CSV file]
   *   - entityType: course
   */
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

      return {
        statusCode: HttpStatus.OK,
        message: 'CSV parsed and validated successfully',
        data: preview,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to parse CSV: ${error.message}`);
    }
  }

  /**
   * Import validated CSV data into database
   * POST /csv/import
   * Content-Type: application/json
   *
   * @example
   * POST http://localhost:3000/csv/import
   * Body:
   * {
   *   "entityType": "course",
   *   "data": [...rows...],
   *   "updateExisting": false
   * }
   */
  @Post('import')
  async importData(
    @Body('entityType') entityType: string,
    @Body('data') data: Record<string, any>[],
    @Body('updateExisting') updateExisting: boolean = false,
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

      return {
        statusCode: HttpStatus.OK,
        message: 'Import completed successfully',
        data: result,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to import data: ${error.message}`);
    }
  }

  /**
   * Complete flow: Upload, validate, and import in one request
   * POST /csv/upload-and-import
   * Content-Type: multipart/form-data
   *
   * This endpoint will:
   * 1. Upload the CSV file
   * 2. Parse and validate the data
   * 3. If no errors, automatically import the data
   * 4. Return both preview and import results
   *
   * @example
   * POST http://localhost:3000/csv/upload-and-import
   * Body:
   *   - file: [CSV file]
   *   - entityType: course
   *   - updateExisting: false (optional)
   */
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
      // Step 1: Parse and preview
      const preview = await this.uploadCsvService.parseAndPreview(
        file,
        entityType as CsvEntityType,
      );

      // Step 2: Check for validation errors
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

      // Step 3: Import if no errors
      const result = await this.uploadCsvService.importData(
        entityType as CsvEntityType,
        preview.rows,
        updateExisting === 'true',
      );

      return {
        statusCode: HttpStatus.OK,
        message: 'CSV uploaded and imported successfully',
        data: {
          preview,
          result,
          imported: true,
        },
      };
    } catch (error) {
      throw new BadRequestException(`Failed to process CSV: ${error.message}`);
    }
  }

  /**
   * Get available entity types
   * GET /csv/entity-types
   */
  @Get('entity-types')
  getEntityTypes() {
    return {
      statusCode: HttpStatus.OK,
      message: 'Available entity types',
      data: Object.values(CsvEntityType).map((type) => ({
        value: type,
        label: type.charAt(0).toUpperCase() + type.slice(1) + 's',
      })),
    };
  }

  /**
   * Health check endpoint
   * GET /csv/health
   */
  @Get('health')
  healthCheck() {
    return {
      statusCode: HttpStatus.OK,
      message: 'CSV import service is running',
      timestamp: new Date().toISOString(),
    };
  }
}
