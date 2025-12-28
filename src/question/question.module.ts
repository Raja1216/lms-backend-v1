import { Module } from '@nestjs/common';
import { QuestionService } from './question.service';
import { QuestionController } from './question.controller';
import { AuthModule } from 'src/auth/auth.module';
import { UserModule } from 'src/user/user.module';
import { QuizModule } from 'src/quiz/quiz.module';
import { QuizService } from 'src/quiz/quiz.service';

@Module({
  imports: [AuthModule, UserModule, QuizModule],
  controllers: [QuestionController],
  providers: [QuestionService, QuizService],
})
export class QuestionModule {}
