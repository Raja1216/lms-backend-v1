// src/user/user.module.ts
import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';

@Module({
  providers: [UserService], // PrismaService removed
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
