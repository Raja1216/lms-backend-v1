import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';

import { CreateShopItemDto } from './dto/create-shop-item.dto';
import { UpdateShopItemDto } from './dto/update-shop-item.dto';
import { ListShopItemDto } from './dto/list-shop-item.dto';

@Injectable()
export class ShopService {
  constructor(private prisma: PrismaService) {}

  async listPublicProducts(query: ListShopItemDto) {
    return this.listItems(
      {
        ...query,
        type: 'product',
      },
      false,
    );
  }

  async listPublicLicenses(query: ListShopItemDto) {
    return this.listItems(
      {
        ...query,
        type: 'license',
      },
      false,
    );
  }

  async adminList(query: ListShopItemDto) {
    return this.listItems(query, true);
  }

  async listItems(query: ListShopItemDto, isAdmin = false) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);

    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.type) {
      where.type = query.type;
    }

    /*
|--------------------------------------------------------------------------
| PUBLIC ONLY ACTIVE
|--------------------------------------------------------------------------
*/

    if (!isAdmin) {
      where.status = 'active';

      where.stock = {
        gt: 0,
      };
    }

    /*
|--------------------------------------------------------------------------
| FILTERS
|--------------------------------------------------------------------------
*/

    if (query.search) {
      where.OR = [
        {
          title: {
            contains: query.search,
          },
        },
        {
          description: {
            contains: query.search,
          },
        },
      ];
    }

    if (query.classLevel) {
      where.class_level = query.classLevel;
    }

    const [items, total] = await Promise.all([
      this.prisma.shop_items.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          created_at: 'desc',
        },
      }),

      this.prisma.shop_items.count({
        where,
      }),
    ]);

    return {
      status: true,
      data: {
        items: items.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          price: item.price,
          originalPrice: item.original_price,
          classLevel: item.class_level,
          image: item.image,
          badge: item.badge,
          rating: item.rating,
          students: item.students,
          seats: item.seats,
          stock: item.stock,
          status: item.status,
          type: item.type,
        })),
        total,
        page,
        limit,
      },
    };
  }

  async create(dto: CreateShopItemDto) {
    const item = await this.prisma.shop_items.create({
      data: {
        type: dto.type,
        title: dto.title,
        description: dto.description,
        price: dto.price,
        original_price: dto.originalPrice,
        class_level: dto.classLevel,
        image: dto.image,
        badge: dto.badge,
        seats: dto.seats,

        stock: dto.stock,

        status: dto.status || 'active',
      },
    });

    return {
      status: true,
      data: item,
    };
  }

  async update(id: number, dto: UpdateShopItemDto) {
    const exists = await this.prisma.shop_items.findUnique({
      where: { id },
    });

    if (!exists) {
      throw new NotFoundException('Item not found');
    }

    const item = await this.prisma.shop_items.update({
      where: { id },
      data: {
        ...(dto.type && { type: dto.type }),

        ...(dto.title && { title: dto.title }),

        ...(dto.description !== undefined && {
          description: dto.description,
        }),

        ...(dto.price !== undefined && {
          price: dto.price,
        }),

        ...(dto.originalPrice !== undefined && {
          original_price: dto.originalPrice,
        }),

        ...(dto.classLevel && {
          class_level: dto.classLevel,
        }),

        ...(dto.image !== undefined && {
          image: dto.image,
        }),

        ...(dto.badge !== undefined && {
          badge: dto.badge,
        }),

        ...(dto.seats !== undefined && {
          seats: dto.seats,
        }),

        ...(dto.stock !== undefined && {
          stock: dto.stock,
        }),

        ...(dto.status && {
          status: dto.status,
        }),
      },
    });

    return {
      status: true,
      data: item,
    };
  }

  async delete(id: number) {
    const exists = await this.prisma.shop_items.findUnique({
      where: { id },
    });

    if (!exists) {
      throw new NotFoundException('Item not found');
    }

    await this.prisma.shop_items.update({
      where: { id },
      data: {
        status: 'deleted',
      },
    });

    return {
      status: true,
      message: 'Deleted',
    };
  }
}
