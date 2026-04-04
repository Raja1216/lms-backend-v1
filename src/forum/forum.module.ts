import { Module } from '@nestjs/common';
import { ForumService } from './forum.service';
import { ForumController } from './forum.controller';
import { AuthModule } from 'src/auth/auth.module';
import { UserModule } from 'src/user/user.module';
import { RoleModule } from 'src/role/role.module';
import { UploadModule } from 'src/upload/upload.module';
@Module({
  controllers: [ForumController],
  providers: [ForumService],
  imports: [AuthModule, UserModule,RoleModule, UploadModule],
})
export class ForumModule {}
