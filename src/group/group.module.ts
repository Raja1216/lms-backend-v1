import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';
import { InstituteGroupController } from './institute-group.controller';

@Module({
  imports: [AuthModule],
  controllers: [GroupController, InstituteGroupController],
  providers: [GroupService],
  exports: [GroupService],
})
export class GroupModule {}
