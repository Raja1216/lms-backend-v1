import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { Msg91Module } from 'src/msg91/msg91.module';

@Module({
  imports: [
    PrismaModule,
    Msg91Module,
  ],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
