import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

export enum ShopItemTypeEnum {
  PRODUCT = 'product',
  LICENSE = 'license',
}

export enum ShopItemStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export class CreateShopItemDto {
  @IsEnum(ShopItemTypeEnum)
  type!: ShopItemTypeEnum;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  originalPrice?: number;

  @IsOptional()
  @IsString()
  classLevel?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  classLevels?: string[];

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsString()
  longDescription?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsString()
  badge?: string;

  /*
  |--------------------------------------------------------------------------
  | LICENSE SEATS
  |--------------------------------------------------------------------------
  */

  @ValidateIf((o) => o.type === 'license')
  @IsNumber()
  @Min(1)
  seats?: number;

  /*
  |--------------------------------------------------------------------------
  | STOCK
  |--------------------------------------------------------------------------
  */

  @ValidateIf((o) => o.type === 'product')
  @IsNumber()
  @Min(0)
  stock?: number;

  /*
  |--------------------------------------------------------------------------
  | STATUS
  |--------------------------------------------------------------------------
  */

  @IsOptional()
  @IsEnum(ShopItemStatusEnum)
  status?: ShopItemStatusEnum;
}
