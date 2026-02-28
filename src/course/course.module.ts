import { Module } from '@nestjs/common';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
import { UserModule } from 'src/user/user.module';
import { AuthModule } from 'src/auth/auth.module';
import { QuizModule } from 'src/quiz/quiz.module';
import { SubjectModule } from 'src/subject/subject.module';
import { UploadModule } from 'src/upload/upload.module';
import { UploadService } from 'src/upload/upload.service';

@Module({
  imports: [UserModule, AuthModule, QuizModule, SubjectModule, UploadModule],
  controllers: [CourseController],
  providers: [CourseService, UploadService],
})
export class CourseModule {}
