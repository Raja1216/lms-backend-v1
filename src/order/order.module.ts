import { Module } from '@nestjs/common';

import { OrderController } from './order.controller';

import { OrderService } from './order.service';

import { PrismaService } from 'src/prisma/prisma.service';
import { RazorpayModule } from 'src/razorpay/razorpay.module';

@Module({
  imports: [RazorpayModule],
  controllers: [OrderController],

  providers: [
    OrderService,
    PrismaService,
  ],
})
export class OrderModule {}