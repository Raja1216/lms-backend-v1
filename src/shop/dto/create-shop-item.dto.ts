import {
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

  @IsString()
  @IsNotEmpty()
  classLevel!: string;

  @IsOptional()
  @IsString()
  image?: string;

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

  @IsNumber()
  @Min(0)
  stock!: number;

  /*
  |--------------------------------------------------------------------------
  | STATUS
  |--------------------------------------------------------------------------
  */

  @IsOptional()
  @IsEnum(ShopItemStatusEnum)
  status?: ShopItemStatusEnum;
}