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

  /*
  |--------------------------------------------------------------------------
  | DETAILS API
  |--------------------------------------------------------------------------
  */

  async getDetails(id: number, isAdmin = false) {
    const where: any = {
      id,
    };

    if (!isAdmin) {
      where.status = 'active';
    }

    const item = await this.prisma.shop_items.findFirst({
      where,
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    return {
      status: true,
      data: {
        id: item.id,
        type: item.type,

        title: item.title,
        description: item.description,

        longDescription: item.long_description,

        price: item.price,
        originalPrice: item.original_price,

        classLevel: item.class_level,

        classLevels: this.parseArray(item.class_levels),

        image: item.image,

        images: Array.isArray(item.images) ? item.images : [],

        badge: item.badge,

        rating: item.rating,

        students: item.students,

        stock: item.stock,

        seats: item.seats,

        status: item.status,

        features: Array.isArray(item.features) ? item.features : [],
      },
    };
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

      if (query.type === 'product') {
        where.stock = {
          gt: 0,
        };
      }

      if (query.type === 'license') {
        where.seats = {
          gt: 0,
        };
      }
    }

    /*
    |--------------------------------------------------------------------------
    | FILTERS
    |--------------------------------------------------------------------------
    */

    const andConditions: any[] = [];

    if (query.search) {
      andConditions.push({
        OR: [
          {
            title: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
        ],
      });
    }

    /*
    |--------------------------------------------------------------------------
    | MULTIPLE CLASS FILTER
    |--------------------------------------------------------------------------
    */

    if (query.classLevels?.length) {
      andConditions.push({
        OR: query.classLevels.map((level) => ({
          class_levels: {
            contains: level,
          },
        })),
      });
    }

    /*
|--------------------------------------------------------------------------
| OLD SINGLE CLASS FILTER SUPPORT
|--------------------------------------------------------------------------
*/

    if (query.classLevel) {
      andConditions.push({
        OR: [
          {
            class_level: query.classLevel,
          },
          {
            class_levels: {
              contains: query.classLevel,
            },
          },
        ],
      });
    }

    if (andConditions.length) {
      where.AND = andConditions;
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

          type: item.type,

          title: item.title,

          description: item.description,

          longDescription: item.long_description,

          price: item.price,

          originalPrice: item.original_price,

          classLevel: item.class_level,

          classLevels: this.parseArray(item.class_levels),

          image: item.image,

          images: Array.isArray(item.images) ? item.images : [],

          badge: item.badge,

          rating: item.rating,

          students: item.students,

          seats: item.seats,

          stock: item.stock,

          status: item.status,

          features: Array.isArray(item.features) ? item.features : [],
        })),

        total,
        page,
        limit,
      },
    };
  }

  private generateRating(): number {
    const min = 40;
    const max = 50;

    const random = Math.floor(Math.random() * (max - min + 1)) + min;

    return Number((random / 10).toFixed(1));
  }

  async create(dto: CreateShopItemDto) {
    const classLevels = dto.classLevels || [];

    const item = await this.prisma.shop_items.create({
      data: {
        type: dto.type,

        title: dto.title,

        description: dto.description,

        long_description: dto.longDescription,

        price: dto.price,

        original_price: dto.originalPrice,

        // backward compatibility
        class_level: classLevels[0] || dto.classLevel || '',

        // new
        class_levels: classLevels.join(','),

        image: dto.image,

        images: dto.images || [],

        badge: dto.badge,

        seats: dto.seats,

        stock: dto.stock || 1,

        features: dto.features || [],

        status: dto.status || 'active',

        rating: this.generateRating(),
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

    const classLevels = dto.classLevels || [];

    const item = await this.prisma.shop_items.update({
      where: { id },

      data: {
        ...(dto.type && {
          type: dto.type,
        }),

        ...(dto.title && {
          title: dto.title,
        }),

        ...(dto.description !== undefined && {
          description: dto.description,
        }),

        ...(dto.longDescription !== undefined && {
          long_description: dto.longDescription,
        }),

        ...(dto.price !== undefined && {
          price: dto.price,
        }),

        ...(dto.originalPrice !== undefined && {
          original_price: dto.originalPrice,
        }),

        ...(dto.classLevels !== undefined && {
          class_level: classLevels[0] || exists.class_level || '',
          class_levels: classLevels.join(','),
        }),

        ...(dto.image !== undefined && {
          image: dto.image,
        }),

        ...(dto.images !== undefined && {
          images: dto.images,
        }),

        ...(dto.badge !== undefined && {
          badge: dto.badge,
        }),

        ...(dto.features !== undefined && {
          features: dto.features,
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

  private parseArray(value?: string | null): string[] {
    if (!value) {
      return [];
    }

    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
}
