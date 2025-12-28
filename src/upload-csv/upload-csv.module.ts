import { Module } from '@nestjs/common';
import { UploadCsvService } from './upload-csv.service';
import { UploadCsvController } from './upload-csv.controller';

@Module({
  controllers: [UploadCsvController],
  providers: [UploadCsvService],
})
export class UploadCsvModule {}
