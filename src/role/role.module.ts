import { Module } from '@nestjs/common';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';
import { UserModule } from 'src/user/user.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports:[AuthModule,UserModule],
  controllers: [RoleController],
  providers: [RoleService],
})
export class RoleModule {}
