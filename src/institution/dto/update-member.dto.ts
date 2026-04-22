import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  ArrayUnique,
  IsNotEmpty,
} from 'class-validator';

export class UpdateMemberDto {
  @ApiProperty({ example: 'user@example.com', required: false })
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Subhajit', required: false })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiProperty({ example: 'strongPassword123', required: false })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'Grade 10', required: false })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiProperty({ example: [1, 2], required: false })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  roles?: number[];
}