import { IsEmail, IsMobilePhone, IsString } from 'class-validator';

export class SendOtpDto {
  @IsEmail()
  email!: string;
}

export class SendMobileOtpDto {
  @IsMobilePhone()
  mobile!: string;
  @IsString()
  mobilePrefix!: string;
}
