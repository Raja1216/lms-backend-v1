// src/user/user.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { AuthModule } from 'src/auth/auth.module';
import { UserEnrollmentModule } from './user-enrollment/user-enrollment.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    UserEnrollmentModule, // 👈 THIS IS REQUIRED
  ],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
