import { Module, forwardRef } from '@nestjs/common';
import { SubjectService } from './subject.service';
import { SubjectController } from './subject.controller';
import { AuthModule } from 'src/auth/auth.module';
import { CourseModule } from 'src/course/course.module';
import { UserModule } from 'src/user/user.module';
import { QuizModule } from 'src/quiz/quiz.module';
import { CourseService } from 'src/course/course.service';
import { UploadModule } from 'src/upload/upload.module';
import { UploadService } from 'src/upload/upload.service';
@Module({
  controllers: [SubjectController],
  providers: [SubjectService, CourseService, UploadService],
  imports: [
    AuthModule,
    UploadModule,
    forwardRef(() => CourseModule), 
    UserModule,
    QuizModule,
  ],
  exports: [SubjectService], 
})
export class SubjectModule {}