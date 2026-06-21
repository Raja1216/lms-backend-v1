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

import { UploadModule } from './upload/upload.module';
import { ModuleModule } from './module/module.module';
import { ProjectModule } from './project/project.module';
import { ProjectSubmissionModule } from './project/project-submission/project-submission.module';
import { StudentDashboardModule } from './student-dashboard/student-dashboard.module';
import { ReportModule } from './report/report.module';
import { ZoomModule } from './zoom/zoom.module';
import { LiveClassModule } from './live-class/live-class.module';
import { InstitutionModule } from './institution/institution.module';
import { CourseManagementModule } from './institution/course-management/course-management.module';
import { CertificateGeneratorService } from './services/certicate-generator/certicate-generator.service';
import { CertificateIssuanceService } from './services/certicate-issuance/certicate-issuance.service';
import { ShopModule } from './shop/shop.module';
import { CartModule } from './cart/cart.module';
import { OrderModule } from './order/order.module';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: Number(configService.get<number>('REDIS_PORT', 6379)),
          password: configService.get<string>('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),
    PrismaModule, // make global provider available early (optional)
    ActivityLogModule,
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
    UploadModule,
    ModuleModule,
    ProjectModule,
    ProjectSubmissionModule,
    ReportModule,
    ZoomModule,
    LiveClassModule,
    StudentDashboardModule,
    InstitutionModule,
    CourseManagementModule,
    ShopModule,
    CartModule,
    OrderModule
  ],
  providers: [CertificateGeneratorService, CertificateIssuanceService],
})
export class AppModule {}
