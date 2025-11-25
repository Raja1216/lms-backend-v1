import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';

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

  async login(payload: { email: string; password: string }) {
    const valid = await this.validateUser(payload.email, payload.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const token = this.jwt.sign({
      sub: (valid as any).id,
      email: (valid as any).email,
    });
    return { access_token: token };
  }

  async register(email: string, password: string, name?: string) {
    const user = await this.users.createUser(email, password, name);
    const access = this.jwt.sign({ sub: (user as any).id, email: user.email });
    return { user, access_token: access };
  }
}
