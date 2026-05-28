import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class OrderService {
  constructor(private prisma: PrismaService) {}

  /*
  |--------------------------------------------------------------------------
  | CHECKOUT
  |--------------------------------------------------------------------------
  */

  async checkout(user_id: number, dto: any) {
    /*
    |--------------------------------------------------------------------------
    | GET CART ITEMS
    |--------------------------------------------------------------------------
    */

    const cart_items = await this.prisma.cart_items.findMany({
      where: {
        user_id,
      },
    });

    if (!cart_items.length) {
      throw new BadRequestException('Cart is empty');
    }

    /*
    |--------------------------------------------------------------------------
    | BUILD ORDER ITEMS
    |--------------------------------------------------------------------------
    */

    const order_items: any[] = [];

    let total_amount = 0;

    for (const item of cart_items) {
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

        if (!course) continue;

        const price = Number(course.discountedPrice);

        const subtotal = price * item.quantity;

        total_amount += subtotal;

        order_items.push({
          item_type: item.item_type,

          item_id: item.item_id,

          title: course.title,

          price,

          quantity: item.quantity,

          subtotal,
        });
      }

      /*
      |--------------------------------------------------------------------------
      | PRODUCT / LICENSE
      |--------------------------------------------------------------------------
      */

      if (item.item_type === 'product' || item.item_type === 'license') {
        const product = await this.prisma.shop_items.findUnique({
          where: {
            id: item.item_id,
          },
        });

        if (!product) continue;

        const subtotal = product.price * item.quantity;

        total_amount += subtotal;

        order_items.push({
          item_type: item.item_type,

          item_id: item.item_id,

          title: product.title,

          price: product.price,

          quantity: item.quantity,

          subtotal,
        });
      }
    }

    /*
    |--------------------------------------------------------------------------
    | CREATE ORDER
    |--------------------------------------------------------------------------
    */

    const order = await this.prisma.orders.create({
      data: {
        user_id,

        order_number: 'ORD-' + Date.now(),

        total_amount,

        notes: dto.notes,

        items: {
          create: order_items,
        },
      },

      include: {
        items: true,
      },
    });

    /*
    |--------------------------------------------------------------------------
    | CLEAR CART
    |--------------------------------------------------------------------------
    */

    await this.prisma.cart_items.deleteMany({
      where: {
        user_id,
      },
    });

    /*
    |--------------------------------------------------------------------------
    | RETURN PAYMENT DETAILS
    |--------------------------------------------------------------------------
    */

    return {
      status: true,

      message: 'Order created successfully',

      data: {
        order_id: order.id,

        order_number: order.order_number,

        total_amount,

        payment: {
          upi_id: 'mentor6@idfcbank',

          qr_image: 'https://files.edudigm.in/payment_qr.jpeg',
        },
      },
    };
  }

  /*
  |--------------------------------------------------------------------------
  | PAYMENT DONE
  |--------------------------------------------------------------------------
  */

  async paymentDone(user_id: number, id: number) {
    const order = await this.prisma.orders.findFirst({
      where: {
        id,
        user_id,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return {
      status: true,

      message:
        'Payment submitted successfully. Waiting for admin verification.',
    };
  }

  /*
  |--------------------------------------------------------------------------
  | MY ORDERS
  |--------------------------------------------------------------------------
  */

  async myOrders(user_id: number) {
    const orders = await this.prisma.orders.findMany({
      where: {
        user_id,
      },

      include: {
        items: true,
      },

      orderBy: {
        created_at: 'desc',
      },
    });

    return {
      status: true,
      data: orders,
    };
  }
}
