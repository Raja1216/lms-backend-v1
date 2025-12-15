import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcrypt';
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserService,
    private readonly jwt: JwtService,
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
    const access = this.jwt.sign({ sub: (user as any).id, email: user.email });
    return { user, access_token: access };
  }
}
