import { Module } from '@nestjs/common';
import { SubjectService } from './subject.service';
import { SubjectController } from './subject.controller';
import { AuthModule } from 'src/auth/auth.module';
import { CourseModule } from 'src/course/course.module';
import { UserModule } from 'src/user/user.module';
import { CourseService } from 'src/course/course.service';
import { QuizModule } from 'src/quiz/quiz.module';

@Module({
  controllers: [SubjectController],
  providers: [SubjectService, CourseService],
  imports: [AuthModule, CourseModule, UserModule, QuizModule],  
})
export class SubjectModule {}
