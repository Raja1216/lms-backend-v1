import { Module } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { QuizController } from './quiz.controller';
import { AuthModule } from 'src/auth/auth.module';
import { UserModule } from 'src/user/user.module';
import { LessonModule } from 'src/lesson/lesson.module';
import { LessonService } from 'src/lesson/lesson.service';
@Module({
  imports: [AuthModule, UserModule, LessonModule],
  controllers: [QuizController],
  exports: [QuizService],
  providers: [QuizService, LessonService],
  
})
export class QuizModule {}
