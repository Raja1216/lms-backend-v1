import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { Prisma } from 'src/generated/prisma/client';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  private makeSlug(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async generateUniqueSlug(
    name: string,
    excludeId?: number,
  ): Promise<string> {
    const baseSlug = this.makeSlug(name) || 'category';

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.category.findFirst({
        where: {
          slug,
          ...(excludeId
            ? {
                id: {
                  not: excludeId,
                },
              }
            : {}),
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  private async validateParent(parentId?: number, currentId?: number) {
    if (!parentId) {
      return;
    }

    if (currentId && parentId === currentId) {
      throw new BadRequestException('Category cannot be its own parent');
    }

    let parent = await this.prisma.category.findUnique({
      where: {
        id: parentId,
      },
      select: {
        id: true,
        parentId: true,
      },
    });

    if (!parent) {
      throw new NotFoundException('Parent category not found');
    }

    /*
     * Prevent:
     *
     * Technology
     *   -> Programming
     *       -> Technology
     */
    if (currentId) {
      while (parent) {
        if (parent.id === currentId) {
          throw new BadRequestException(
            'Circular category hierarchy is not allowed',
          );
        }

        if (!parent.parentId) {
          break;
        }

        parent = await this.prisma.category.findUnique({
          where: {
            id: parent.parentId,
          },
          select: {
            id: true,
            parentId: true,
          },
        });
      }
    }
  }

  /**
   * Reusable validation for Course, Shop Item,
   * Publication, Discussion etc.
   */
  async validateCategoryIds(categoryIds: number[] = []) {
    const ids = [...new Set(categoryIds)];

    if (!ids.length) {
      return [];
    }

    const categories = await this.prisma.category.findMany({
      where: {
        id: {
          in: ids,
        },
        status: true,
      },
      select: {
        id: true,
      },
    });

    if (categories.length !== ids.length) {
      throw new BadRequestException(
        'One or more selected categories are invalid or inactive',
      );
    }

    return ids;
  }

  async create(dto: CreateCategoryDto) {
    await this.validateParent(dto.parentId);

    const duplicateName = await this.prisma.category.findFirst({
      where: {
        name: dto.name,
        status: true,
      },
      select: {
        id: true,
      },
    });

    if (duplicateName) {
      throw new ConflictException('Category with this name already exists');
    }

    const slug = await this.generateUniqueSlug(dto.name);

    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        image: dto.image,
        parentId: dto.parentId,
        sortOrder: dto.sortOrder ?? 0,
        isFeatured: dto.isFeatured ?? false,
        status: dto.status ?? true,
      },

      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  async findAll(query: CategoryQueryDto) {
    const { page = 1, limit = 10, keyword, status, parentId } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.CategoryWhereInput = {};

    if (keyword) {
      where.OR = [
        {
          name: {
            contains: keyword,
          },
        },
        {
          slug: {
            contains: keyword,
          },
        },
        {
          description: {
            contains: keyword,
          },
        },
      ];
    }

    if (status !== undefined) {
      where.status = status;
    }

    if (parentId !== undefined) {
      where.parentId = parentId;
    }

    const [categories, total] = await Promise.all([
      this.prisma.category.findMany({
        where,

        skip,
        take: limit,

        orderBy: [
          {
            sortOrder: 'asc',
          },
          {
            name: 'asc',
          },
        ],

        include: {
          parent: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },

          _count: {
            select: {
              courseCategories: true,
              shopItemCategories: true,
              children: true,
            },
          },
        },
      }),

      this.prisma.category.count({
        where,
      }),
    ]);

    const data = categories.map((category) => {
      const { _count, ...rest } = category;

      return {
        ...rest,

        usage: {
          courses: _count.courseCategories,
          shopItems: _count.shopItemCategories,
          children: _count.children,

          total: _count.courseCategories + _count.shopItemCategories,
        },
      };
    });

    return {
      data,
      total,
    };
  }

  async findOne(id: number) {
    const category = await this.prisma.category.findUnique({
      where: {
        id,
      },

      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },

        children: {
          orderBy: {
            sortOrder: 'asc',
          },

          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },

        _count: {
          select: {
            courseCategories: true,
            shopItemCategories: true,
            children: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const { _count, ...rest } = category;

    return {
      ...rest,

      usage: {
        courses: _count.courseCategories,
        shopItems: _count.shopItemCategories,
        children: _count.children,
        total: _count.courseCategories + _count.shopItemCategories,
      },
    };
  }

  async getOptions() {
    return this.prisma.category.findMany({
      where: {
        status: true,
      },

      orderBy: [
        {
          sortOrder: 'asc',
        },
        {
          name: 'asc',
        },
      ],

      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
      },
    });
  }

  async getTree() {
    const categories = await this.prisma.category.findMany({
      orderBy: [
        {
          sortOrder: 'asc',
        },
        {
          name: 'asc',
        },
      ],

      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        image: true,
        sortOrder: true,
        isFeatured: true,
        status: true,
      },
    });

    const map = new Map<number, any>();

    categories.forEach((category) => {
      map.set(category.id, {
        ...category,
        children: [],
      });
    });

    const tree: any[] = [];

    categories.forEach((category) => {
      const item = map.get(category.id);

      if (category.parentId && map.has(category.parentId)) {
        map.get(category.parentId).children.push(item);
      } else {
        tree.push(item);
      }
    });

    return tree;
  }

  async update(id: number, dto: UpdateCategoryDto) {
    const existing = await this.prisma.category.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    if (dto.parentId !== undefined) {
      await this.validateParent(dto.parentId, id);
    }

    if (dto.name && dto.name !== existing.name) {
      const duplicateName = await this.prisma.category.findFirst({
        where: {
          name: dto.name,
          id: {
            not: id,
          },
          status: true,
        },

        select: {
          id: true,
        },
      });

      if (duplicateName) {
        throw new ConflictException('Category with this name already exists');
      }
    }

    let slug = existing.slug;

    if (dto.name && dto.name !== existing.name) {
      slug = await this.generateUniqueSlug(dto.name, id);
    }

    return this.prisma.category.update({
      where: {
        id,
      },

      data: {
        ...dto,
        slug,
      },

      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  async updateStatus(id: number) {
    const category = await this.prisma.category.findUnique({
      where: {
        id,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return this.prisma.category.update({
      where: {
        id,
      },

      data: {
        status: !category.status,
      },
    });
  }

  async remove(id: number) {
    const category = await this.prisma.category.findUnique({
      where: {
        id,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const activeChildren = await this.prisma.category.count({
      where: {
        parentId: id,
        status: true,
      },
    });

    if (activeChildren > 0) {
      throw new BadRequestException(
        'Category has active child categories. Deactivate them first.',
      );
    }

    // Soft delete
    return this.prisma.category.update({
      where: {
        id,
      },

      data: {
        status: false,
      },
    });
  }
}
