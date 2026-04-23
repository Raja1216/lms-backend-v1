import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import * as bcrypt from 'bcrypt';
import { generateSlug } from 'src/shared/generate-slug';
import { PaginationDto } from 'src/shared/dto/pagination-dto';
import { contains } from 'class-validator';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Injectable()
export class InstitutionService {
  constructor(private readonly prisma: PrismaService) {}
  async create(dto: CreateInstitutionDto) {
    const role = await this.prisma.role.findFirst({
      where: { name: 'Institution Owner' },
    });
    if (!role) {
      throw new Error('Role "Institution Owner" not found');
    }
    const hashedPassword = await bcrypt.hash(dto.ownerPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.ownerEmail,
        name: dto.ownerName,
        password: hashedPassword,
        roles: role
          ? {
              connect: { id: role.id },
            }
          : undefined,
      },
    });
    const slug = generateSlug(dto.name);
    const institution = await this.prisma.institution.create({
      data: {
        name: dto.name,
        slug: slug,
        ownerId: user.id,
        logo: dto.logo,
        address: dto.address,
        website: dto.website,
        street: dto.street,
        city: dto.city,
        state: dto.state,
        country: dto.country,
        pincode: dto.pincode,
      },
    });
    const institutionUser = await this.prisma.institutionMember.create({
      data: {
        userId: user.id,
        institutionId: institution.id,
      },
    });
    return { institution, user, institutionUser };
  }
  async getInstitutions(paginationDto: PaginationDto, userId: number) {
    const { page = 1, limit = 10, keyword } = paginationDto;
    const skip = (page - 1) * limit;
    const { isSuperAdmin, institutionId } = await this.checkSuperAdmin(userId);
    const whereClause: any = keyword
      ? {
          name: {
            contains: keyword,
          },
          status: true,
        }
      : { status: true };
    if (!isSuperAdmin) {
      if (!institutionId) {
        throw new UnauthorizedException(
          'User does not belong to any institution',
        );
      }
      whereClause.id = institutionId;
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.institution.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: {
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { members: true, institutionCourses: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.institution.count({ where: whereClause }),
    ]);
    return { data, total, page, limit };
  }
  async getInstitutionDetails(id: number, userId: number) {
    const { isSuperAdmin, institutionId } = await this.checkSuperAdmin(userId);
    if (!isSuperAdmin && institutionId !== id) {
      throw new ForbiddenException('Access denied to this institution');
    }
    const institution = await this.prisma.institution.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { members: true, institutionCourses: true } },
      },
    });
    if (!institution) throw new NotFoundException('Institution not found');
    return institution;
  }
  async update(id: number, requesterId: number, dto: UpdateInstitutionDto) {
    const { isSuperAdmin, institutionId } =
      await this.checkSuperAdmin(requesterId);
    if (!isSuperAdmin && institutionId !== id) {
      throw new ForbiddenException('Access denied to this institution');
    }
    return await this.prisma.institution.update({ where: { id }, data: dto });
  }
  async findInstitutionByName(name: string, id?: number): Promise<boolean> {
    const whereClause: any = { name };
    if (id) {
      whereClause.id = { not: id };
    }
    const institution = await this.prisma.institution.findFirst({
      where: whereClause,
    });
    return !!institution;
  }

  async updateInstitutionStatus(id: number, requesterId: number) {
    const { isSuperAdmin, institutionId } =
      await this.checkSuperAdmin(requesterId);
    if (!isSuperAdmin && institutionId !== id) {
      throw new ForbiddenException('Access denied to this institution');
    }
    const institution = await this.prisma.institution.findUnique({
      where: { id },
    });
    if (!institution) {
      throw new NotFoundException('Institution not found');
    }
    return await this.prisma.institution.update({
      where: { id },
      data: { status: !institution.status },
    });
  }

  async removeInstitution(id: number, userId: number) {
    const { isSuperAdmin, institutionId } = await this.checkSuperAdmin(userId);
    if (!isSuperAdmin && institutionId !== id) {
      throw new ForbiddenException('Access denied to this institution');
    }
    return await this.prisma.institution.delete({
      where: { id },
    });
  }

  async addMember(
    institutionId: number,
    requesterId: number,
    dto: AddMemberDto,
  ) {
    const { isSuperAdmin, institutionId: userInstitutionId } =
      await this.checkSuperAdmin(requesterId);
    if (!isSuperAdmin && userInstitutionId !== institutionId) {
      throw new ForbiddenException('Access denied to this institution');
    }

    if (dto.roles) {
      const validRoles = await this.prisma.role.findMany({
        where: { id: { in: dto.roles } },
      });

      if (validRoles.length !== dto.roles.length) {
        throw new BadRequestException('Some roles are invalid');
      }

      if (!isSuperAdmin) {
        const allowedRoles = ['TEACHER', 'STUDENT', 'INSTITUTION OWNER'];

        const hasInvalidRole = validRoles.some(
          (role) => !allowedRoles.includes(role.name.toUpperCase()),
        );

        if (hasInvalidRole) {
          throw new BadRequestException(
            'You can only assign TEACHER, STUDENT, or INSTITUTION_OWNER roles',
          );
        }
      }
    }
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        classGrade: dto.level,
        password: hashedPassword,
        roles: dto?.roles?.length
          ? {
              connect: dto.roles.map((id) => ({ id })),
            }
          : undefined,
      },
    });
    return this.prisma.institutionMember.create({
      data: { institutionId, userId: user.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }
  async updateMember(
    institutionId: number,
    memberId: number,
    requesterId: number,
    dto: UpdateMemberDto,
  ) {
    const { isSuperAdmin, institutionId: userInstitutionId } =
      await this.checkSuperAdmin(requesterId);

    if (!isSuperAdmin && userInstitutionId !== institutionId) {
      throw new ForbiddenException('Access denied to this institution');
    }

    const member = await this.prisma.institutionMember.findFirst({
      where: {
        id: memberId,
        institutionId,
      },
      include: { user: true },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this institution');
    }
    if (dto.roles) {
      const validRoles = await this.prisma.role.findMany({
        where: { id: { in: dto.roles } },
      });

      if (validRoles.length !== dto.roles.length) {
        throw new BadRequestException('Some roles are invalid');
      }

      if (!isSuperAdmin) {
        const allowedRoles = ['TEACHER', 'STUDENT', 'INSTITUTION OWNER'];

        const hasInvalidRole = validRoles.some(
          (role) => !allowedRoles.includes(role.name.toUpperCase()),
        );

        if (hasInvalidRole) {
          throw new BadRequestException(
            'You can only assign TEACHER, STUDENT, or INSTITUTION_OWNER roles',
          );
        }
      }
    }

    let hashedPassword: string | undefined;
    if (dto.password) {
      hashedPassword = await bcrypt.hash(dto.password, 10);
    }
    await this.prisma.user.update({
      where: { id: member.userId },
      data: {
        email: dto.email,
        name: dto.name,
        classGrade: dto.level,
        ...(hashedPassword && { password: hashedPassword }),
        ...(!dto.roles && {
          roles: {
            set: [],
          },
        }),
        ...(dto.roles && {
          roles: {
            set: dto.roles.map((id) => ({ id })),
          },
        }),
      },
    });

    return await this.prisma.institutionMember.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            roles: { select: { name: true } },
          },
        },
      },
    });
  }
  async updateMemberStatus(
    institutionId: number,
    memberId: number,
    requesterId: number,
  ) {
    const { isSuperAdmin, institutionId: userInstitutionId } =
      await this.checkSuperAdmin(requesterId);

    if (!isSuperAdmin && userInstitutionId !== institutionId) {
      throw new ForbiddenException('Access denied to this institution');
    }

    const member = await this.prisma.institutionMember.findFirst({
      where: {
        id: memberId,
        institutionId,
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this institution');
    }
    await this.prisma.user.update({
      where: { id: member.userId },
      data: {
        status: !member.status,
      },
    });

    return await this.prisma.institutionMember.update({
      where: { id: memberId },
      data: { status: !member.status },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            roles: { select: { name: true } },
          },
        },
      },
    });
  }

  async getMembers(
    institutionId: number,
    paginationDto: PaginationDto,
    requesterId: number,
  ) {
    const { isSuperAdmin, institutionId: userInstitutionId } =
      await this.checkSuperAdmin(requesterId);

    if (!isSuperAdmin && userInstitutionId !== institutionId) {
      throw new ForbiddenException('Access denied to this institution');
    }
    const { role = null, page = 1, limit = 10, keyword = null } = paginationDto;
    const skip = (page - 1) * limit;
    const whereClause: any = { institutionId, status: true };
    if (role) {
      whereClause.user = { roles: { some: { name: role } } };
    }
    if (keyword) {
      whereClause.user.OR = [
        { name: { contains: keyword } },
        { email: { contains: keyword } },
      ];
    }

    const [members, total] = await Promise.all([
      this.prisma.institutionMember.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              classGrade: true,
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.institutionMember.count({ where: whereClause }),
    ]);
    return { data: members, total, page, limit };
  }
  async getMember(
    institutionId: number,
    memberId: number,
    requesterId: number,
  ) {
    const { isSuperAdmin, institutionId: userInstitutionId } =
      await this.checkSuperAdmin(requesterId);

    if (!isSuperAdmin && userInstitutionId !== institutionId) {
      throw new ForbiddenException('Access denied to this institution');
    }
    const member = await this.prisma.institutionMember.findFirst({
      where: {
        id: memberId,
        institutionId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            classGrade: true,
            roles: { select: { name: true, id: true } },
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this institution');
    }

    return member;
  }
  async removeMember(
    institutionId: number,
    memberId: number,
    requesterId: number,
  ) {
    const { isSuperAdmin, institutionId: userInstitutionId } =
      await this.checkSuperAdmin(requesterId);

    if (!isSuperAdmin && userInstitutionId !== institutionId) {
      throw new ForbiddenException('Access denied to this institution');
    }

    const member = await this.prisma.institutionMember.delete({
      where: {
        id: memberId,
        institutionId,
      },
    });
    return await this.prisma.user.delete({
      where: { id: member.userId },
    });
  }

  async findUserByEmail(email: string, id?: number): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        ...(id && { id: { not: id } }),
      },
    });

    return !!user;
  }

  async checkSuperAdmin(
    userId: number,
  ): Promise<{ isSuperAdmin: boolean; institutionId?: number }> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        name: true,
        roles: {
          select: {
            name: true,
          },
        },
        institutionMembers: {
          select: {
            institutionId: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Normalize role names to avoid case issues
    const roleNames = user.roles.map((r) => r.name.toUpperCase());

    const isSuperAdmin = roleNames.includes('SUPER ADMIN');

    // If super admin, no need to bind to an institution
    if (isSuperAdmin) {
      return { isSuperAdmin: true };
    }

    // Otherwise, return institution context if exists
    const institutionId = user.institutionMembers?.[0]?.institutionId;
    console.log('user', user);
    return {
      isSuperAdmin: false,
      ...(institutionId && { institutionId }),
    };
  }

  private async assertMemberExists(institutionId: number, userId: number) {
    const member = await this.prisma.institutionMember.findUnique({
      where: { institutionId_userId: { institutionId, userId } },
    });
    if (!member || !member.status) {
      throw new NotFoundException('Member not found');
    }
    return member;
  }
}
