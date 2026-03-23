import { Module } from '@nestjs/common';
import { ProjectGradingService } from './project-grading.service';
import { ProjectGradingController } from './project-grading.controller';
import { UserModule } from 'src/user/user.module';
import { AuthModule } from 'src/auth/auth.module';
@Module({
  controllers: [ProjectGradingController],
  providers: [ProjectGradingService],
  imports: [UserModule, AuthModule],
})
export class ProjectGradingModule {}
