import { Module } from '@nestjs/common';
import { ProjectSubmissionService } from './project-submission.service';
import { ProjectSubmissionController } from './project-submission.controller';
import { UploadService } from 'src/upload/upload.service';
import { UploadModule } from 'src/upload/upload.module';
import { AuthModule } from 'src/auth/auth.module';
import { UserModule } from 'src/user/user.module';
@Module({
  controllers: [ProjectSubmissionController],
  providers: [ProjectSubmissionService, UploadService],
  imports: [UploadModule, AuthModule, UserModule],
})
export class ProjectSubmissionModule {}
