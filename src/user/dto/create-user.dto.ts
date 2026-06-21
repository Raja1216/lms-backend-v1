// src/user/dto/create-user.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import { Match } from 'src/custom-validator/is-matched.validator';
import { UserType } from 'src/generated/prisma/enums';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Subhajit', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'strongPassword123' })
  @IsString()
  // @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  classGrade?: string;

  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;

  @IsArray()
  @ApiProperty({ example: [1, 2], required: false })
  @IsOptional()
  roles?: number[];

  @IsString()
  @ApiProperty({
    example: '919876543210',
    required: true,
    description: 'Mobile number without country code symbol',
  })
  @IsNotEmpty()
  @Matches(/^\d{6,14}$/, {
    message:
      'Mobile number must contain only digits and be 6 to 14 digits long',
  })
  mobileNumber!: string;

  @IsString()
  @ApiProperty({
    example: '+91',
    required: true,
    description: 'International dialing prefix',
  })
  @IsNotEmpty()
  @Matches(/^\+\d{1,4}$/, {
    message: 'Mobile prefix must be a valid international dialing code',
  })
  mobilePrefix!: string;

  @IsOptional()
  @IsNumber()
  @ApiProperty({ example: 1, required: false })
  institutionId?: number;

  @IsOptional()
  @IsString()
  @Length(2, 190)
  @ApiProperty({ example: 'st. xavier school', required: false })
  schoolName?: string;
}
