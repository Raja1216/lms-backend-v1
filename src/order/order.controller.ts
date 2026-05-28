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

@Controller('orders')
@UseGuards(AuthGuard('jwt'))
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | CREATE ORDER
  |--------------------------------------------------------------------------
  */

  @Post('checkout')
  async checkout(
    @Req() req,
    @Body() dto: CreateOrderDto,
  ) {
    return this.orderService.checkout(
      Number(req.user.id),
      dto,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | PAYMENT DONE
  |--------------------------------------------------------------------------
  */

  @Post(':id/payment-done')
  async paymentDone(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orderService.paymentDone(
      Number(req.user.id),
      id,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | MY ORDERS
  |--------------------------------------------------------------------------
  */

  @Get('my-orders')
  async myOrders(@Req() req) {
    return this.orderService.myOrders(
      Number(req.user.id),
    );
  }
}