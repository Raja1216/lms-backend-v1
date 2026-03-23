import { Module } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { UserModule } from 'src/user/user.module';
import { AuthModule } from 'src/auth/auth.module';
import { ProjectGradingModule } from './project-grading/project-grading.module';

@Module({
  imports: [UserModule, AuthModule, ProjectGradingModule],
  controllers: [ProjectController],
  providers: [ProjectService],
})
export class ProjectModule {}
