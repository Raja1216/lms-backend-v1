import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { Permission } from 'src/generated/prisma/browser';
import { PrismaService } from 'src/prisma/prisma.service';
import { generateSlug } from 'src/shared/generate-slug';
import { PaginationDto } from 'src/shared/dto/pagination-dto';
@Injectable()
export class PermissionService {
  constructor(private readonly prismaService: PrismaService) {}
  async create(
    createPermissionDto: CreatePermissionDto,
  ): Promise<Permission[]> {
    const { permission_type, display_name, description, resource, action } =
      createPermissionDto;
    const permissions: Permission[] = [];

    try {
      if (permission_type === 'basic') {
        if (!display_name || !description) {
          throw new Error('Display name and description are required.');
        }

        await this.prismaService.permission.create({
          data: {
            name: display_name,
            description: description,
            slug: generateSlug(display_name),
          },
        });
      } else {
        if (!resource || !action || action.length === 0) {
          throw new Error('Resource and at least one action are required.');
        }

        for (const act of action) {
          if (!['create', 'read', 'update', 'delete'].includes(act)) {
            throw new Error(`Invalid action: ${act}.`);
          }
          permissions.push(
            await this.prismaService.permission.create({
              data: {
                name: `${this.capitalize(resource)} ${this.capitalize(act)}`,
                description: `Allows a user to ${act} a ${this.capitalize(resource)}`,
                slug: generateSlug(
                  `${this.capitalize(resource)} ${this.capitalize(act)}`,
                ),
              },
            }),
          );
        }
      }
    } catch (error: any) {
      throw new Error(
        `Permission could not be created. ${error instanceof Error ? error.message : ''}`,
      );
    }

    return permissions;
  }

  async findAll(paginationDto: PaginationDto) {
    const { keyword, page = 1, limit = 10 } = paginationDto;
    const permission = await this.prismaService.permission.findMany({
      where: keyword
        ? {
            OR: [
              { name: { contains: keyword } },
              { slug: { contains: keyword } },
              { description: { contains: keyword } },
            ],
          }
        : {},
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit,
      skip: (page - 1) * limit,
    });
    const total = await this.prismaService.permission.count({
      where: keyword
        ? {
            OR: [
              { name: { contains: keyword } },
              { slug: { contains: keyword } },
              { description: { contains: keyword } },
            ],
          }
        : {},
    });
    return { permission, total };
  }

  async findOne(id: number) {
    const permission = await this.prismaService.permission.findUnique({
      where: { id },
    });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }
    console.log(permission);
    return permission;
  }

  async update(id: number, updatePermissionDto: UpdatePermissionDto) {
    const permission = await this.prismaService.permission.findUnique({
      where: { id },
    });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }
    const { display_name, description } = updatePermissionDto;
    const updatedPermission = await this.prismaService.permission.update({
      where: { id },
      data: {
        name: display_name,
        description: description,
        slug: generateSlug(display_name),
      },
    });
    return updatedPermission;
  }

  async remove(id: number) {
    const permission = await this.prismaService.permission.findUnique({
      where: { id },
    });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }
    return this.prismaService.permission.delete({ where: { id } });
  }
  private capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}
