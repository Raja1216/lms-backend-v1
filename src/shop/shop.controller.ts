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
  UseGuards,
  Req,
} from '@nestjs/common';

import { ShopService } from './shop.service';

import { CreateShopItemDto } from './dto/create-shop-item.dto';
import { UpdateShopItemDto } from './dto/update-shop-item.dto';
import { ListShopItemDto } from './dto/list-shop-item.dto';
import { OptionalJwtAuthGuard } from 'src/auth/optional-jwt.guard';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Controller()
export class ShopController {
  constructor(
    private readonly shopService: ShopService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | PUBLIC APIs
  |--------------------------------------------------------------------------
  */

  @UseGuards(OptionalJwtAuthGuard)
  @Get('shop/products')
  async getProducts(@Req() req: any, @Query() query: ListShopItemDto) {
    if (req.user?.id) {
      try {
        await this.activityLogService.logActivity(req.user.id, 'Shop Page Visited');
      } catch (err) {
        console.error('Failed to log Shop Page Visited activity', err);
      }
    }
    return this.shopService.listPublicProducts(query);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('shop/licenses')
  async getLicenses(@Req() req: any, @Query() query: ListShopItemDto) {
    if (req.user?.id) {
      try {
        await this.activityLogService.logActivity(req.user.id, 'Shop Page Visited');
      } catch (err) {
        console.error('Failed to log Shop Page Visited activity', err);
      }
    }
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
