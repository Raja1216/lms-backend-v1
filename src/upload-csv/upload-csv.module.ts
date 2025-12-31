import { Module } from '@nestjs/common';
import { UploadCsvService } from './upload-csv.service';
import { UploadCsvController } from './upload-csv.controller';
import {AuthModule} from 'src/auth/auth.module';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [AuthModule, UserModule],
  controllers: [UploadCsvController],
  providers: [UploadCsvService],
})
export class UploadCsvModule {}
