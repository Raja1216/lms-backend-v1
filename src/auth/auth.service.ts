import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcrypt';
import { OtpService } from 'src/otp/otp.service';
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserService,
    private readonly jwt: JwtService,
    private readonly optService:OtpService
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user) return null;
    // compare password using bcrypt in user service or here
    const validated = await this.users.validatePassword(email, password);
    return validated;
  }

  async login(payload: {
    email: string;
    password: string;
  }): Promise<{ access_token: string; user: any }> {
    const user = await this.users.findByEmail(payload.email);
    if (!user) {
      throw new UnauthorizedException('User not found');
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
    };
    const { password, ...userWithoutPassword } = user;
    return {
      access_token: await this.jwt.signAsync(jwtPayload),
      user: userWithoutPassword,
    };
  }

  async register(email: string, password: string, name?: string) {
    const user = await this.users.createUser(email, password, name);
    const jwtPayload = {
      sub: user.id,
      email: user.email,
    };
    return { user, access_token: await this.jwt.signAsync(jwtPayload) };
  }

  async resetPassword(email: string, newPassword: string, otp: string) {
    const isOtpValid=await this.optService.validateOtp(email,otp)
    if(isOtpValid){
      const updatedUser = await this.users.updateUser(email, newPassword);
      return updatedUser;
    }
    throw new UnauthorizedException('Invalid OTP');
  }
}
