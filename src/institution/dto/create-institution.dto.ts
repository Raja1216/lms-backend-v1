import {
  IsString,
  IsOptional,
  IsUrl,
  MaxLength,
  MinLength,
  IsEmail,
  IsNotEmpty,
} from 'class-validator';

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
