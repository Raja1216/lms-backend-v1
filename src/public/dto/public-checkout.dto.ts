import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  IsInt,
} from 'class-validator';

export class PublicCheckoutDto {
  @IsInt()
  courseId: number;

  @IsOptional()
  @IsString()
  fullName: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @Matches(/^\+\d{1,4}$/)
  mobilePrefix: string;

  @IsString()
  @Matches(/^\d{6,14}$/)
  mobileNumber: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsString()
  classGrade?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  schoolName?: string;
}
