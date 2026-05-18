import { Module } from '@nestjs/common';
import { LessonService } from './lesson.service';
import { LessonController } from './lesson.controller';
import { AuthModule } from 'src/auth/auth.module';
import { UserModule } from 'src/user/user.module';
import { ChapterModule } from 'src/chapter/chapter.module';
import { ChapterService } from 'src/chapter/chapter.service';
import { UploadModule } from 'src/upload/upload.module';
import { CertificateGeneratorService } from 'src/services/certicate-generator/certicate-generator.service';
import { CertificateIssuanceService } from 'src/services/certicate-issuance/certicate-issuance.service';
@Module({
  imports:[AuthModule, UserModule, ChapterModule, UploadModule],
  controllers: [LessonController],
  providers: [
    LessonService,
    ChapterService,
    CertificateGeneratorService,
    CertificateIssuanceService,
  ],
})
export class LessonModule {}
