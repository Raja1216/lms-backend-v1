// src/user/dto/update-user.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'updated@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Updated Name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 'newStrongPassword123',
    description: 'Password must be at least 6 characters',
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ example: 'updatedClass' })
  @IsOptional()
  @IsString()
  class?: string;

  @ApiPropertyOptional({ example: [2, 3], description: 'Array of role IDs' })
  @IsOptional()
  roles?: number[];
}
