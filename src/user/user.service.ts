import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { User } from 'src/generated/prisma/browser';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(email: string, password: string, name?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Email already in use');

    const saltRounds = 10;
    const hashed = await bcrypt.hash(password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        password: hashed,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: number) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('User not found');
    return u;
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

  async updateUser(
    email?: string,
    password?: string,
    name?: string,
    level?: string,
  ) {
    const saltRounds = 10;
    let hashed: string | null = null;
    if (password) {
      hashed = await bcrypt.hash(password, saltRounds);
    }
    const user = await this.prisma.user.update({
      where: { email },
      data: {
        ...(hashed && { password: hashed }),
        ...(name && { name }),
        ...(level && { class: level }),
      },
    });
    return user;
  }

  async getUserAccess(
  user: User
): Promise<{ slugs: string[]; ids: number[] }> {
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

}
