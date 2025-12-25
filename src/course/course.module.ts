import { Module } from '@nestjs/common';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
import { UserModule } from 'src/user/user.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [UserModule, AuthModule],
  controllers: [CourseController],
  providers: [CourseService],
})
export class CourseModule {}
