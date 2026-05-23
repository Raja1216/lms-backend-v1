import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';

import { AddToCartDto } from './dto/add-to-cart.dto';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  /*
  |--------------------------------------------------------------------------
  | ADD TO CART
  |--------------------------------------------------------------------------
  */

  async addToCart(user_id: number, dto: AddToCartDto) {
    const item = await this.prisma.shop_items.findFirst({
      where: {
        id: dto.shop_item_id,
        status: 'active',
      },
    });

    if (!item) {
      throw new NotFoundException('Shop item not found');
    }

    if (item.stock < dto.quantity) {
      throw new BadRequestException('Insufficient stock');
    }

    const existing = await this.prisma.cart_items.findUnique({
      where: {
        user_id_shop_item_id: {
          user_id,
          shop_item_id: dto.shop_item_id,
        },
      },
    });

    let cart_item;

    if (existing) {
      const new_quantity = existing.quantity + dto.quantity;

      if (item.stock < new_quantity) {
        throw new BadRequestException('Insufficient stock');
      }

      cart_item = await this.prisma.cart_items.update({
        where: {
          id: existing.id,
        },
        data: {
          quantity: new_quantity,
        },
      });
    } else {
      cart_item = await this.prisma.cart_items.create({
        data: {
          user_id,
          shop_item_id: dto.shop_item_id,
          quantity: dto.quantity,
        },
      });
    }

    return {
      status: true,
      message: 'Item added to cart',
      data: cart_item,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | REMOVE CART ITEM
  |--------------------------------------------------------------------------
  */

  async removeCartItem(user_id: number, id: number) {
    const cart_item = await this.prisma.cart_items.findFirst({
      where: {
        id,
        user_id,
      },
    });

    if (!cart_item) {
      throw new NotFoundException('Cart item not found');
    }

    await this.prisma.cart_items.delete({
      where: {
        id,
      },
    });

    return {
      status: true,
      message: 'Cart item removed',
    };
  }

  /*
  |--------------------------------------------------------------------------
  | LIST CART
  |--------------------------------------------------------------------------
  */

  async listCart(user_id: number) {
    const items = await this.prisma.cart_items.findMany({
      where: {
        user_id,
      },

      include: {
        shop_items: true,
      },

      orderBy: {
        created_at: 'desc',
      },
    });

    const formatted_items = items.map((item) => {
      const subtotal = item.quantity * item.shop_items.price;

      return {
        cart_item_id: item.id,

        quantity: item.quantity,

        subtotal,

        product: {
          id: item.shop_items.id,

          type: item.shop_items.type,

          title: item.shop_items.title,

          description: item.shop_items.description,

          price: item.shop_items.price,

          original_price: item.shop_items.original_price,

          class_level: item.shop_items.class_level,

          image: item.shop_items.image,

          badge: item.shop_items.badge,

          stock: item.shop_items.stock,

          seats: item.shop_items.seats,
        },
      };
    });

    const total_amount = formatted_items.reduce(
      (sum, item) => sum + item.subtotal,
      0,
    );

    return {
      status: true,
      data: {
        items: formatted_items,

        total_items: formatted_items.length,

        total_amount,
      },
    };
  }
}
