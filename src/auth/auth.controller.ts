// src/auth/auth.controller.ts
import { Controller, Post, Body, Req, Res, Next } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { successResponse } from 'src/utils/success-response';
import { Request, Response, NextFunction } from 'express';
import { ErrorHandler } from 'src/utils/error-handler';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({
    status: 201,
    description: 'Successful login returns the JWT token.',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const user = await this.auth.login(dto);
      const cookieOptions = {
        expires: new Date(
          Date.now() +
            Number(process.env.JWT_EXPIRY || 1) * 24 * 60 * 60 * 1000,
        ),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'None',
      };
      res.cookie('access_token', cookieOptions);
      return successResponse(
        res,
        200,
        'Login successful',
        { user, access_token: user.access_token },
        null,
      );
    } catch (err) {
      return next(
        new ErrorHandler(
          err instanceof Error ? err.message : 'Internal Server Error',
          401,
        ),
      );
    }
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User created and access token returned',
  })
  async register(@Body() dto: CreateUserDto) {
    return this.auth.register(dto.email, dto.password, dto.name);
  }
}
