import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { generateSlug } from 'src/shared/generate-slug';
import { group } from 'console';
import { PaginationDto } from 'src/shared/dto/pagination-dto';

@Injectable()
export class RoleService {
  constructor(private readonly prismaService: PrismaService) {}
  async create(createRoleDto: CreateRoleDto) {
    const { name, description } = createRoleDto;
    const permissions = await this.prismaService.permission.findMany({
      where: {
        id: {
          in: createRoleDto.permissions,
        },
      },
    });
    const role = await this.prismaService.role.create({
      data: {
        name: name,
        description: description,
        slug: generateSlug(name),
        permissions: {
          connect: permissions.map((permission) => ({ id: permission.id })),
        },
      },
    });
    return role;
  }

  async findAll(paginationDto: PaginationDto) {
    const { keyword, page = 1, limit = 10 } = paginationDto;

    const where = keyword
      ? {
          OR: [
            { name: { contains: keyword } },
            { slug: { contains: keyword } },
            { description: { contains: keyword } },
          ],
        }
      : {};

    const [roles, total] = await this.prismaService.$transaction([
      this.prismaService.role.findMany({
        where,
        orderBy: {
          updatedAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.role.count({ where }),
    ]);

    return {
      roles,
      total,
    };
  }

  async findOne(id: number) {
    const role = await this.prismaService.role.findUnique({
      where: { id },
      select: {
        permissions: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
          },
        },
      },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async update(id: number, updateRoleDto: UpdateRoleDto) {
    const { name, description } = updateRoleDto;
    const permissions = await this.prismaService.permission.findMany({
      where: {
        id: {
          in: updateRoleDto.permissions || [],
        },
      },
    });
    const role = await this.prismaService.role.findUnique({
      where: { id },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return await this.prismaService.role.update({
      where: { id: id },
      data: {
        name: name,
        slug: name ? generateSlug(name) : role.slug,
        description: description,
        permissions: {
          set: [], // remove old permissions
          connect: permissions.map((permission) => ({ id: permission.id })),
        },
      },
    });
  }

  async reloadSuperAdmin() {
    const superAdminRole = await this.prismaService.role.findUnique({
      where: { slug: 'super-admin' },
    });
    if (!superAdminRole) {
      throw new NotFoundException('Super Admin role not found');
    }
    const allPermissions = await this.prismaService.permission.findMany();
    return await this.prismaService.role.update({
      where: { id: superAdminRole.id },
      data: {
        permissions: {
          set: [], // remove old permissions
          connect: allPermissions.map((permission) => ({ id: permission.id })),
        },
      },
    });
  }

  async remove(id: number) {
    const role = await this.prismaService.role.findUnique({
      where: { id },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    const deletedRole = await this.prismaService.role.delete({ where: { id } });
    if (deletedRole) {
      return deletedRole;
    }
    throw new BadRequestException('Something went wrong');
  }
}
