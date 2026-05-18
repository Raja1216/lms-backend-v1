// import {
//   CanActivate,
//   ExecutionContext,
//   forwardRef,
//   Inject,
//   Injectable,
//   UnauthorizedException,
// } from '@nestjs/common';
// import { JwtService } from '@nestjs/jwt';
// import { Request } from 'express';
// import { UserService } from '../user/user.service';
// import * as dotenv from 'dotenv';
// dotenv.config();

// @Injectable()
// export class JwtAuthGuard implements CanActivate {
//   constructor(
//     private jwtService: JwtService,
//     @Inject(forwardRef(() => UserService))
//     private userService: UserService,
//   ) {}

//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     const request: Request = context.switchToHttp().getRequest<Request>();
//     const token = this.extractTokenFromHeader(request);
//     if (!token) {
//       throw new UnauthorizedException();
//     }
//     try {
//       const payload: { [key: string]: any } = await this.jwtService.verifyAsync(
//         token,
//         {
//           secret: process.env.JWT_SECRET, // Replace with your actual secret
//         },
//       );
//       // 💡 We're assigning the payload to the request object here
//       // so that we can access it in our route handlers
//       const email = typeof payload.email === 'string' ? payload.email : '';
//       if (!email) {
//         throw new UnauthorizedException('Invalid email in token payload');
//       }
//       request['user'] = await this.userService.findByEmail(email);
//     } catch {
//       throw new UnauthorizedException();
//     }
//     return true;
//   }

//   private extractTokenFromHeader(request: Request): string | undefined {
//     const [type, token] = request.headers.authorization?.split(' ') ?? [];
//     return type === 'Bearer' ? token : undefined;
//   }
// }

// import { Injectable } from '@nestjs/common';
// import { AuthGuard } from '@nestjs/passport';

// @Injectable()
// export class JwtAuthGuard extends AuthGuard('jwt') {}

import {
  Injectable,
  ExecutionContext,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';

import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic =
      this.reflector.getAllAndOverride<boolean>(
        'isPublic',
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    // ✅ skip auth for public routes
    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
