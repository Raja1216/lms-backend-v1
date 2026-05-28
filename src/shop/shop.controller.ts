import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { ShopService } from './shop.service';

import { CreateShopItemDto } from './dto/create-shop-item.dto';
import { UpdateShopItemDto } from './dto/update-shop-item.dto';
import { ListShopItemDto } from './dto/list-shop-item.dto';

@Controller()
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  /*
  |--------------------------------------------------------------------------
  | PUBLIC APIs
  |--------------------------------------------------------------------------
  */

  @Get('shop/products')
  async getProducts(@Query() query: ListShopItemDto) {
    return this.shopService.listPublicProducts(query);
  }

  @Get('shop/licenses')
  async getLicenses(@Query() query: ListShopItemDto) {
    return this.shopService.listPublicLicenses(query);
  }

  /*
  |--------------------------------------------------------------------------
  | ADMIN APIs
  |--------------------------------------------------------------------------
  */

  @Get('admin/shop/items')
  async adminList(@Query() query: ListShopItemDto) {
    return this.shopService.listItems(query);
  }

  @Post('admin/shop/items')
  async create(@Body() dto: CreateShopItemDto) {
    return this.shopService.create(dto);
  }

  @Get('shop/items/:id')
  async getDetails(@Param('id', ParseIntPipe) id: number) {
    return this.shopService.getDetails(id);
  }

  @Get('admin/shop/items/:id')
  async adminDetails(@Param('id', ParseIntPipe) id: number) {
    return this.shopService.getDetails(id, true);
  }

  @Put('admin/shop/items/:id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShopItemDto,
  ) {
    return this.shopService.update(id, dto);
  }

  @Delete('admin/shop/items/:id')
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.shopService.delete(id);
  }
}
