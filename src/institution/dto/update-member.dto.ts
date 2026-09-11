import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  ArrayUnique,
} from 'class-validator';

export class UpdateMemberDto {
  @ApiProperty({ example: 'user@example.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'Subhajit', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'strongPassword123', required: false })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiProperty({ example: 'Grade 10', required: false })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiProperty({ example: '+919876543210', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: '+919876543210', required: false })
  @IsOptional()
  @IsString()
  mobile?: string;

  @ApiProperty({ example: 'Teacher', required: false })
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiProperty({ example: 'TEACHER', required: false })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @ApiProperty({ example: [1, 2], required: false })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  roles?: number[];
}