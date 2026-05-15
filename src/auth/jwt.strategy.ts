// import { Injectable } from '@nestjs/common';
// import { PassportStrategy } from '@nestjs/passport';
// import { Strategy, ExtractJwt } from 'passport-jwt';
// import { ConfigService } from '@nestjs/config';
// import { UserService } from 'src/user/user.service';

// @Injectable()
// export class JwtStrategy extends PassportStrategy(Strategy) {
//   constructor(
//     config: ConfigService,
//     private readonly users: UserService,
//   ) {
//     super({
//       jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
//       ignoreExpiration: false,
//       secretOrKey: config.get<string>('JWT_SECRET') || 'changeme',
//     });
//   }

//   async validate(payload: any) {
//     // payload.sub contains user id by our sign logic
//     const user = await this.users.findById(payload.sub);
//     // optionally strip sensitive fields
//     const { password_hash, ...safe } = user as any;
//     return safe;
//   }
// }

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from 'src/user/user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_SECRET') ?? 'default_secret',
    });
  }

  async validate(payload: { email: string; mobileNumber: string }) {
    if (!payload?.email && !payload?.mobileNumber) {
      throw new UnauthorizedException('Invalid token payload');
    }
    let user: any = null;
    if (payload.email) {
      user = await this.userService.findByEmail(payload.email);
    }
    if (payload.mobileNumber) {
      user = await this.userService.findByMobileNumber(payload.mobileNumber);
    }

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // 👇 This becomes request.user
    return user;
  }
}
