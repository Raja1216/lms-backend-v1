// src/user/user.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly svc: UserService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created' })
  async create(@Body() body: CreateUserDto) {
    const user = await this.svc.createUser(
      body.email,
      body.password,
      body.name,
    );
    return user;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get user by id (protected)' })
  @ApiResponse({ status: 200, description: 'User found' })
  async get(@Param('id') id: string) {
    return this.svc.findById(Number(id));
  }

  // optional: a 'me' endpoint using the validated user from JwtStrategy
  @Get('me/profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current logged in user' })
  async profile(@Request() req) {
    // req.user is set by JwtStrategy.validate()
    return req.user;
  }
}
