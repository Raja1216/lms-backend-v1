import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcrypt';
import { OtpService } from 'src/otp/otp.service';
import { User } from 'src/generated/prisma/browser';
import { PrismaService } from 'src/prisma/prisma.service';
import { SendMobileOtpDto } from './dto/send-otp.dto';
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserService,
    private readonly jwt: JwtService,
    private readonly optService: OtpService,
    private readonly prisma: PrismaService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user) return null;
    // compare password using bcrypt in user service or here
    const validated = await this.users.validatePassword(email, password);
    return validated;
  }

  async login(payload: {
    mobilePrefix: string;
    mobileNumber: string;
    password: string;
  }): Promise<{ access_token: string; user: any }> {
    const user = await this.prisma.user.findFirst({
      where: {
        mobile_prefix: payload.mobilePrefix,
        mobile: payload.mobileNumber,
      },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isPasswordValid = await bcrypt.compare(
      payload.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const jwtPayload = {
      sub: user.id,
      email: user.email,
      mobileNumber: user.mobile,
    };
    const { password, ...userWithoutPassword } = user;
    return {
      access_token: await this.jwt.signAsync(jwtPayload),
      user: userWithoutPassword,
    };
  }

  

  async register(
    email: string,
    password: string,
    mobilePrefix: string,
    mobileNumber: string,
    level: string,
    name?: string,
    institutionId?: number,
    schoolName?: string
  ) {
    const user = await this.users.createUser(
      email,
      password,
      mobileNumber,
      mobilePrefix,
      name,
      level,
      institutionId,
      [],
      schoolName 
    );
    const jwtPayload = {
      sub: user.id,
      email: user.email,
    };
    return { user, access_token: await this.jwt.signAsync(jwtPayload) };
  }

  async resetPassword(email: string, newPassword: string, otp: string) {
    const isOtpValid = await this.optService.validateOtp(email, otp);
    if (isOtpValid) {
      const updatedUser = await this.users.resetPassword(email, newPassword);
      return updatedUser;
    }
    throw new UnauthorizedException('Invalid OTP');
  }
  async resetPasswordMobile(
    mobile: string,
    mobilePrefix: string,
    newPassword: string,
    otp: string,
  ) {
    const isOtpValid = await this.optService.validateMobileOtp(
      mobile,
      otp,
      mobilePrefix,
    );
    if (isOtpValid) {
      const updatedUser = await this.users.resetPasswordUsingMobile(
        mobile,
        mobilePrefix,
        newPassword,
      );
      return updatedUser;
    }
    throw new UnauthorizedException('Invalid OTP');
  }
  async getMyAccess(user: User): Promise<{ slugs: string[]; ids: number[] }> {
    return await this.users.getUserAccess(user);
  }
}
