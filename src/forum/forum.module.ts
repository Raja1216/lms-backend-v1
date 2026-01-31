import { Module } from '@nestjs/common';
import { ForumService } from './forum.service';
import { ForumController } from './forum.controller';
import { AuthModule } from 'src/auth/auth.module';
import { UserModule } from 'src/user/user.module';
@Module({
  controllers: [ForumController],
  providers: [ForumService],
  imports: [AuthModule, UserModule],
})
export class ForumModule {}
