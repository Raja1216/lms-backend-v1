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
    let item: any;

    /*
  |--------------------------------------------------------------------------
  | COURSE
  |--------------------------------------------------------------------------
  */

    if (dto.item_type === 'course') {
      item = await this.prisma.course.findFirst({
        where: {
          id: dto.item_id,
          status: true,
        },
      });

      if (!item) {
        throw new NotFoundException('Course not found');
      }

      // course quantity always 1
      dto.quantity = 1;
    }

    /*
  |--------------------------------------------------------------------------
  | PRODUCT / LICENSE
  |--------------------------------------------------------------------------
  */

    if (dto.item_type === 'product' || dto.item_type === 'license') {
      item = await this.prisma.shop_items.findFirst({
        where: {
          id: dto.item_id,
          type: dto.item_type,
          status: 'active',
        },
      });

      if (!item) {
        throw new NotFoundException('Item not found');
      }

      if (item.stock < dto.quantity) {
        throw new BadRequestException('Insufficient stock');
      }
    }

    /*
  |--------------------------------------------------------------------------
  | EXISTING CART ITEM
  |--------------------------------------------------------------------------
  */

    const existing = await this.prisma.cart_items.findUnique({
      where: {
        user_id_item_type_item_id: {
          user_id,
          item_type: dto.item_type,
          item_id: dto.item_id,
        },
      },
    });

    let cart_item;

    if (existing) {
      const new_quantity = existing.quantity + dto.quantity;

      if (dto.item_type !== 'course' && item.stock < new_quantity) {
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

          item_type: dto.item_type,

          item_id: dto.item_id,

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

      orderBy: {
        created_at: 'desc',
      },
    });

    const formatted_items = await Promise.all(
      items.map(async (item) => {
        let product: any = null;

        /*
      |--------------------------------------------------------------------------
      | COURSE
      |--------------------------------------------------------------------------
      */

        if (item.item_type === 'course') {
          const course = await this.prisma.course.findUnique({
            where: {
              id: item.item_id,
            },
          });

          if (!course) return null;

          product = {
            id: course.id,

            type: 'course',

            title: course.title,

            description: course.description,

            image: course.thumbnail,

            price: Number(course.discountedPrice),

            original_price: Number(course.price),

            grade: course.grade,

            duration: course.duration,
          };
        }

        /*
      |--------------------------------------------------------------------------
      | PRODUCT / LICENSE
      |--------------------------------------------------------------------------
      */

        if (item.item_type === 'product' || item.item_type === 'license') {
          const shop_item = await this.prisma.shop_items.findUnique({
            where: {
              id: item.item_id,
            },
          });

          if (!shop_item) return null;

          product = {
            id: shop_item.id,

            type: shop_item.type,

            title: shop_item.title,

            description: shop_item.description,

            image: shop_item.image,

            price: shop_item.price,

            original_price: shop_item.original_price,

            class_level: shop_item.class_level,

            badge: shop_item.badge,

            stock: shop_item.stock,

            seats: shop_item.seats,
          };
        }

        const subtotal = item.quantity * product.price;

        return {
          cart_item_id: item.id,

          item_type: item.item_type,

          item_id: item.item_id,

          quantity: item.quantity,

          subtotal,

          product,
        };
      }),
    );

    const valid_items = formatted_items.filter(
      (item): item is NonNullable<typeof item> => item !== null,
    );

    const total_amount = valid_items.reduce(
      (sum, item) => sum + item.subtotal,
      0,
    );

    return {
      status: true,

      data: {
        items: valid_items,

        total_items: valid_items.length,

        total_amount,
      },
    };
  }
}
