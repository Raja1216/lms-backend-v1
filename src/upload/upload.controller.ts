import {
  Controller,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('file')
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 200 * 1024 * 1024, // 200MB
    },
  }),)
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('type') type: string,
  ) {
    return this.uploadService.uploadFile(file, type);
  }
}
