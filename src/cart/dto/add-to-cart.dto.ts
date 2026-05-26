import {
  IsInt,
  Min,
} from 'class-validator';

export class AddToCartDto {
  @IsInt()
  shop_item_id!: number;

  @IsInt()
  @Min(1)
  quantity!: number;
}