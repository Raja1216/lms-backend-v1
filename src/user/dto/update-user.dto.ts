import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  IsNotEmpty,
  Matches,
  IsEnum,
} from 'class-validator';
import { UserType } from 'src/generated/prisma/enums';

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

  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;

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

  @ApiPropertyOptional({ example: 'updatedClass' })
  @IsOptional()
  @IsString()
  classGrade?: string;

  @ApiPropertyOptional({ example: [2, 3], description: 'Array of role IDs' })
  @IsOptional()
  roles?: number[];
}
