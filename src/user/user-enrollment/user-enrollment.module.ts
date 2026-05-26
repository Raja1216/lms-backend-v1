import { Module } from '@nestjs/common';
import { UserEnrollmentService } from './user-enrollment.service';
import { UserEnrollmentController } from './user-enrollment.controller';

@Module({
  controllers: [UserEnrollmentController],
  providers: [UserEnrollmentService],
})
export class UserEnrollmentModule {}
