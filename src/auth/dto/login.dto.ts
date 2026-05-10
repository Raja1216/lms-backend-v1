import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  IsNotEmpty,
  Matches,
} from 'class-validator';

export class LoginDto {
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

  @ApiProperty({ example: 'strongPassword123' })
  @IsString()
  @MinLength(6)
  password!: string;
}
