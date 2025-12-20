// src/user/dto/create-user.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Subhajit', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'strongPassword123' })
  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @ApiProperty({ example: 'user' })
  class: string;

  @IsArray()
  @ApiProperty({ example: [1, 2], required: false })
  @IsOptional()
  roles?: number[];
}
