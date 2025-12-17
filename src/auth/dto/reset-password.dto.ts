import { IsNumber, IsEmail, IsString, MinLength } from 'class-validator';
import { Match } from '../../custom_validator/is-matched.validator';
export class ResetPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  otp: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
  @Match('newPassword', { message: 'Passwords do not match' })
  confirmPassword: string;
}
