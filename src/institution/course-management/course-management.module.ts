import { Module } from '@nestjs/common';
import { CourseManagementService } from './course-management.service';
import { CourseManagementController } from './course-management.controller';
import { InstitutionModule } from '../institution.module';

@Module({
  imports: [InstitutionModule],
  controllers: [CourseManagementController],
  providers: [CourseManagementService],
})
export class CourseManagementModule {}
