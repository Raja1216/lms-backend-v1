import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';

export class ListShopItemDto {
  @IsOptional()
  @IsNumberString()
  page?: string = '1';

  @IsOptional()
  @IsNumberString()
  limit?: string = '10';

  @IsOptional()
  @IsString()
  search?: string;

  // OLD SUPPORT
  @IsOptional()
  @IsString()
  classLevel?: string;

  // NEW
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  classLevels?: string[];

  @IsOptional()
  @IsIn(['product', 'license'])
  type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;
}
