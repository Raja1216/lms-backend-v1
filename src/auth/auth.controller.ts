// src/auth/auth.controller.ts
import { Controller, Post, Body, Req, Res, Next, UseGuards,HttpStatus,Get,Request as NestJsRequest } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { successResponse } from 'src/utils/success-response';
import { Request, Response, NextFunction } from 'express';
import { ErrorHandler } from 'src/utils/error-handler';
import { SendOtpDto } from './dto/send-otp.dto';
import { ResetPasswordDto} from './dto/reset-password.dto';
import { OtpService } from 'src/otp/otp.service';
import { JwtAuthGuard } from './jwt.guard';
import { User } from 'src/generated/prisma/browser';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly otpService: OtpService,
  ) {}

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
      res.cookie('token', user.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: Number(process.env.JWT_EXPIRY || 1) * 24 * 60 * 60 * 1000,
      });

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
          err.status ? err.status : 401,
          // 600
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
  async register(
    @Body() dto: CreateUserDto,
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { name, email, password } = dto;
      const user = await this.auth.register(email, password, name);
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
        'Registration successful',
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

  @Post('send-otp')
  async sendOtp(
    @Body() dto: SendOtpDto,
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.otpService.sendOrResendOtp(dto);
      return successResponse(res, 200, 'OTP sent successfully', {}, null);
    } catch (err) {
      return next(
        new ErrorHandler(
          err instanceof Error ? err.message : 'Internal Server Error',
          500,
        ),
      );
    }
  }

  @Post('reset-password')
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { email, newPassword, otp } = dto;
      const data=await this.auth.resetPassword(email, newPassword, otp);
      return successResponse(res, 200, 'Password reset successfully', data, null);
    } catch (err) {
      return next(
        new ErrorHandler(
          err instanceof Error ? err.message : 'Internal Server Error',
          500,
        ),
      );
    }
  }
  @UseGuards(JwtAuthGuard)
  @Get('my-access')
  async getMyAccess(@NestJsRequest() req: { user: User }, @Res() res: Response) {
    const access = await this.auth.getMyAccess(req.user);
    return successResponse(
      res,
      HttpStatus.OK,
      'Access retrieved successfully',
      access,
      {},
    );
  }
}
