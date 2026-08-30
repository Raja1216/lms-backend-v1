import { Module } from '@nestjs/common';

import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';
import { CategoryModule } from 'src/category/category.module';

@Module({
  imports: [CategoryModule],
  controllers: [ShopController],
  providers: [ShopService],
})
export class ShopModule {}
