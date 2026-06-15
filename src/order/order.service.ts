import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { RazorpayService } from 'src/razorpay/razorpay.service';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import * as crypto from 'crypto';

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private razorpayService: RazorpayService,
  ) {}

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

    const razorpayOrder = await this.razorpayService
      .getInstance()
      .orders.create({
        amount: Math.round(total_amount * 100),
        currency: 'INR',
        receipt: order.order_number,
      });

    await this.prisma.orders.update({
      where: {
        id: order.id,
      },
      data: {
        razorpay_order_id: razorpayOrder.id,
      },
    });

    /*
    |--------------------------------------------------------------------------
    | RETURN PAYMENT DETAILS
    |--------------------------------------------------------------------------
    */

    // return {
    //   status: true,

    //   message: 'Order created successfully',

    //   data: {
    //     order_id: order.id,

    //     order_number: order.order_number,

    //     total_amount,

    //     payment: {
    //       upi_id: 'mentor6@idfcbank',

    //       qr_image: 'https://files.edudigm.in/payment_qr.jpeg',
    //     },
    //   },
    // };
    return {
      status: true,
      data: {
        order_id: order.id,
        razorpay_order_id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        key: process.env.RAZORPAY_KEY_ID,
      },
    };
  }

  async verifyPayment(user_id: number, dto: VerifyPaymentDto) {
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(dto.razorpay_order_id + '|' + dto.razorpay_payment_id)
      .digest('hex');

    if (generatedSignature !== dto.razorpay_signature) {
      throw new BadRequestException('Payment verification failed');
    }

    const order = await this.prisma.orders.findFirst({
      where: {
        razorpay_order_id: dto.razorpay_order_id,
        user_id,
      },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === 'paid') {
      return {
        status: true,
        message: 'Payment already verified',
      };
    }
    await this.prisma.orders.update({
      where: {
        id: order.id,
      },
      data: {
        status: 'paid',
        razorpay_payment_id: dto.razorpay_payment_id,
        razorpay_signature: dto.razorpay_signature,
        paid_at: new Date(),
      },
    });

    for (const item of order.items) {
      if (item.item_type === 'course') {
        const exists = await this.prisma.userEnrolledCourse.findFirst({
          where: {
            userId: user_id,
            courseId: item.item_id,
          },
        });

        if (!exists) {
          await this.prisma.userEnrolledCourse.create({
            data: {
              userId: user_id,
              courseId: item.item_id,
            },
          });
        }
      }
    }

    await this.prisma.cart_items.deleteMany({
      where: {
        user_id,
      },
    });

    return {
      status: true,
      message: 'Payment successful',
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
