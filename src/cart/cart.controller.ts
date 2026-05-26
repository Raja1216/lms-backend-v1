import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import { CartService } from './cart.service';

import { AddToCartDto } from './dto/add-to-cart.dto';

@Controller('cart')
@UseGuards(AuthGuard('jwt'))
export class CartController {
  constructor(
    private readonly cartService: CartService,
  ) {}

  @Post('add')
  async addToCart(
    @Req() req,
    @Body() dto: AddToCartDto,
  ) {
    return this.cartService.addToCart(
      Number(req.user.id),
      dto,
    );
  }

  @Delete('remove/:id')
  async removeCartItem(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cartService.removeCartItem(
      Number(req.user.id),
      id,
    );
  }

  @Get('list')
  async listCart(@Req() req) {
    return this.cartService.listCart(
      Number(req.user.id),
    );
  }
}