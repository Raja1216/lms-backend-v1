import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export enum CartItemType {
  course = 'course',
  product = 'product',
  license = 'license',
}

export class AddToCartDto {
  @IsEnum(CartItemType)
  item_type!: CartItemType;

  @IsInt()
  item_id!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity: number = 1;
}
