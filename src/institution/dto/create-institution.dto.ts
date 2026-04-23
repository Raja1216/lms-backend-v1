import {
  IsString,
  IsOptional,
  IsUrl,
  MaxLength,
  MinLength,
  IsEmail,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { Match } from 'src/custom-validator/is-matched.validator';

export class CreateInstitutionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsUrl()
  logo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
  @IsOptional()
  @IsString()
  @MaxLength(190)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  country?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[1-9][0-9]{5}$/, {
    message: 'Pincode must be a valid 6-digit Indian PIN code',
  })
  pincode?: string;

  @IsOptional()
  @IsUrl()
  website?: string;
  @IsNotEmpty()
  @IsString()
  ownerName!: string;

  @IsEmail()
  @IsNotEmpty()
  ownerEmail!: string;
  @IsNotEmpty()
  @IsString()
  ownerPassword!: string;
}
