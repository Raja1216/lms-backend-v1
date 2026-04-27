import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  ArrayUnique,
} from 'class-validator';

export class AddMemberDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Subhajit', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'strongPassword123' })
  @IsString()
  @MinLength(6)
  password!: string;
  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'user' })
  level?: string;

  @IsArray()
  @ApiProperty({ example: [1, 2], required: false })
  @IsOptional()
  @ArrayUnique()
  roles?: number[];
}
