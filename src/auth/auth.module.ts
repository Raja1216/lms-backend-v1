// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { UserModule } from 'src/user/user.module';
import { JwtStrategy } from './jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { OtpModule } from 'src/otp/otp.module';
import { JwtAuthGuard } from './jwt.guard';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '30d' },
    }),
    UserModule,
    OtpModule,
  ],
  // removed PrismaService from here
  providers: [AuthService, JwtStrategy,JwtAuthGuard],
  controllers: [AuthController],
  exports: [AuthService,JwtAuthGuard,
    JwtModule,],
})
export class AuthModule {}
