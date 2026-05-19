import { Module } from '@nestjs/common';
import { ProjectGradingService } from './project-grading.service';
import { ProjectGradingController } from './project-grading.controller';
import { UserModule } from 'src/user/user.module';
import { AuthModule } from 'src/auth/auth.module';
import { forwardRef } from '@nestjs/common';
import { ProjectModule } from '../project.module';
@Module({
  controllers: [ProjectGradingController],
  providers: [ProjectGradingService],
  imports: [UserModule, AuthModule, forwardRef(() => ProjectModule)],
})
export class ProjectGradingModule {}
