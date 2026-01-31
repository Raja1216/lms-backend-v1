// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { OtpModule } from './otp/otp.module';
import { RoleModule } from './role/role.module';
import { PermissionModule } from './permission/permission.module';
import { CourseModule } from './course/course.module';
import { SubjectModule } from './subject/subject.module';
import { LessonModule } from './lesson/lesson.module';
import { ChapterModule } from './chapter/chapter.module';
import { QuizModule } from './quiz/quiz.module';
import { QuestionModule } from './question/question.module';
import { UploadCsvModule } from './upload-csv/upload-csv.module';
import { PortfolioModule } from './auth/portfolio/portfolio.module';
import { ForumModule } from './forum/forum.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,  // make global provider available early (optional)
    UserModule,
    AuthModule,
    OtpModule,
    RoleModule,
    PermissionModule,
    CourseModule,
    SubjectModule,
    LessonModule,
    ChapterModule,
    QuizModule,
    QuestionModule,
    UploadCsvModule,
    PortfolioModule,
    ForumModule,
  ],
})
export class AppModule {}
