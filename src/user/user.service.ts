import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { User } from 'src/generated/prisma/browser';
import { PaginationDto } from 'src/shared/dto/pagination-dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(
    email: string,
    password: string,
    name?: string,
    level?: string,
    roles?: number[],
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        classGrade: level,

        // connect roles if provided
        roles: roles?.length
          ? {
              connect: roles.map((id) => ({ id })),
            }
          : undefined,
      },
      select: {
        id: true,
        uuid: true,
        email: true,
        name: true,
        classGrade: true,
        roles: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
      },
    });

    return user;
  }

  async findAll(paginationDto: PaginationDto) {
    const { page = 1, limit = 10, keyword } = paginationDto;

    const skip = (page - 1) * limit;

    const whereClause = keyword
      ? {
          OR: [
            {
              email: {
                contains: keyword,
              },
            },
            {
              name: {
                contains: keyword,
              },
            },
            {
              username: {
                contains: keyword,
              },
            },
            {
              mobile: {
                contains: keyword,
              },
            },
          ],
        }
      : {};

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          uuid: true,
          email: true,
          name: true,
          username: true,
          classGrade: true,
          status: true,
          createdAt: true,
          roles: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),

      this.prisma.user.count({
        where: whereClause,
      }),
    ]);

    return { users, total };
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique(
      { where: { email }, select:{
        id: true,
        uuid: true,
        email: true,
        name: true,
        username: true,
        classGrade: true,
        status: true,
        password: true,
        createdAt: true,
        roles: {
          select: {
            id: true,
            name: true,
          },
        },
      } });
  }

  async findById(id: number) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('User not found');
    return u;
  }
  async updateUser(
    id: number,
    data: {
      email?: string;
      password?: string;
      name?: string;
      classGrade?: string;
      roles?: number[];
      status?: boolean;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // check email uniqueness
    if (data.email && data.email !== user.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (emailExists) {
        throw new BadRequestException('Email already in use');
      }
    }

    let hashedPassword: string | undefined;
    if (data.password) {
      hashedPassword = await bcrypt.hash(data.password, 10);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        email: data.email,
        name: data.name,
        classGrade: data.classGrade,
        status: data.status,
        password: hashedPassword,

        // replace roles completely if provided
        roles: data.roles
          ? {
              set: [], // remove old roles
              connect: data.roles.map((id) => ({ id })),
            }
          : undefined,
      },
      select: {
        id: true,
        uuid: true,
        email: true,
        name: true,
        classGrade: true,
        status: true,
        roles: {
          select: {
            id: true,
            name: true,
          },
        },
        updatedAt: true,
      },
    });

    return updatedUser;
  }

  async validatePassword(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) return null;

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return null;

    // remove password_hash before returning
    // (or return only selected fields)
    // return user; // has password_hash
    const { password_hash, ...safe } = user as any;
    return safe;
  }

  async getUserAccess(user: User): Promise<{ slugs: string[]; ids: number[] }> {
    const loadedUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        roles: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!loadedUser) {
      throw new NotFoundException('User not found');
    }

    const slugSet = new Set<string>();
    const idSet = new Set<number>();

    for (const role of loadedUser.roles) {
      for (const permission of role.permissions) {
        slugSet.add(permission.slug);
        idSet.add(permission.id);
      }
    }

    return {
      slugs: Array.from(slugSet),
      ids: Array.from(idSet),
    };
  }

  async resetPassword(email: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updatedUser = await this.prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    return updatedUser;
  }
}
