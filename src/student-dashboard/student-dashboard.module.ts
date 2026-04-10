import { Module } from '@nestjs/common';
import { StudentDashboardService } from './student-dashboard.service';
import { StudentDashboardController } from './student-dashboard.controller';
import { AuthModule } from 'src/auth/auth.module';
import { UserModule } from 'src/user/user.module';
@Module({
  imports: [AuthModule, UserModule],
  controllers: [StudentDashboardController],
  providers: [StudentDashboardService],
})
export class StudentDashboardModule {}
