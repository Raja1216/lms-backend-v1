import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import { OrderService } from './order.service';

import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@Controller('orders')
@UseGuards(AuthGuard('jwt'))
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /*
  |--------------------------------------------------------------------------
  | CREATE ORDER
  |--------------------------------------------------------------------------
  */

  @Post('checkout')
  async checkout(@Req() req, @Body() dto: CreateOrderDto) {
    return this.orderService.checkout(Number(req.user.id), dto);
  }

  /*
  |--------------------------------------------------------------------------
  | VERIFY ORDER
  |--------------------------------------------------------------------------
  */

  @Post('verify-payment')
  async verifyPayment(@Req() req, @Body() dto: VerifyPaymentDto) {
    return this.orderService.verifyPayment(Number(req.user.id), dto);
  }

  /*
  |--------------------------------------------------------------------------
  | MY ORDERS
  |--------------------------------------------------------------------------
  */

  @Get('my-orders')
  async myOrders(@Req() req) {
    return this.orderService.myOrders(Number(req.user.id));
  }
}
