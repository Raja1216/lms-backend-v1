import { Module } from '@nestjs/common';
import { InstitutionService } from './institution.service';
import { InstitutionController } from './institution.controller';
import { UserModule } from 'src/user/user.module';
import { AuthModule } from 'src/auth/auth.module';
@Module({
  imports: [UserModule, AuthModule],
  controllers: [InstitutionController],
  providers: [InstitutionService],
})
export class InstitutionModule {}
