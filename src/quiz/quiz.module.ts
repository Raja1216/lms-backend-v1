import { Module } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { QuizController } from './quiz.controller';
import { AuthModule } from 'src/auth/auth.module';
import { UserModule } from 'src/user/user.module';
import { LessonModule } from 'src/lesson/lesson.module';
import { LessonService } from 'src/lesson/lesson.service';
import { UploadModule } from 'src/upload/upload.module';
import { CertificateGeneratorService } from 'src/services/certicate-generator/certicate-generator.service';
import { CertificateIssuanceService } from 'src/services/certicate-issuance/certicate-issuance.service';
@Module({
  imports: [AuthModule, UserModule, LessonModule, UploadModule],
  controllers: [QuizController],
  exports: [QuizService],
  providers: [
    QuizService,
    LessonService,
    CertificateGeneratorService,
    CertificateIssuanceService,
  ],
  
})
export class QuizModule {}
