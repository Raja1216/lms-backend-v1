import { Type } from 'class-transformer';
import {
  IsUrl,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDate,
} from 'class-validator';
export class AddProjectDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsUrl()
  demoUrl?: string;

  @IsOptional()
  @IsUrl()
  gitHubUrl?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  date?: Date;
}
