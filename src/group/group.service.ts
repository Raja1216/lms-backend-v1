import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  GroupType,
  GroupUserSource,
  InstitutionMemberRole,
  Prisma,
} from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAdminGroupDto } from './dto/create-admin-group.dto';
import { CreateInstituteGroupDto } from './dto/create-institute-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupQueryDto } from './dto/group-query.dto';
import { GroupUserQueryDto } from './dto/group-user-query.dto';

@Injectable()
export class GroupService {
  constructor(private readonly prisma: PrismaService) {}

  private makeSlug(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async generateUniqueSlug(name: string, excludeId?: number) {
    const baseSlug = this.makeSlug(name) || 'group';
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.group.findFirst({
        where: {
          slug,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      });

      if (!existing) return slug;
      slug = `${baseSlug}-${counter++}`;
    }
  }

  private normalizeIds(ids: number[] = []) {
    return [...new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  }

  private async validateInstitutionIds(ids: number[] = []) {
    const institutionIds = this.normalizeIds(ids);
    if (!institutionIds.length) return institutionIds;

    const institutions = await this.prisma.institution.findMany({
      where: { id: { in: institutionIds } },
      select: { id: true },
    });

    if (institutions.length !== institutionIds.length) {
      throw new BadRequestException('One or more institutions are invalid');
    }

    return institutionIds;
  }

  private async validateUserIds(ids: number[] = []) {
    const userIds = this.normalizeIds(ids);
    if (!userIds.length) return userIds;

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true },
    });

    if (users.length !== userIds.length) {
      throw new BadRequestException('One or more users are invalid');
    }

    return userIds;
  }

  private async validateInstitutionUserIds(institutionId: number, ids: number[] = []) {
    const userIds = this.normalizeIds(ids);
    if (!userIds.length) return userIds;

    const members = await this.prisma.institutionMember.findMany({
      where: {
        institutionId,
        userId: { in: userIds },
        status: true,
      },
      select: { userId: true },
    });

    if (members.length !== userIds.length) {
      throw new BadRequestException(
        'One or more selected users do not belong to this institution',
      );
    }

    return userIds;
  }

  /**
   * Private authorization check to verify that actorUserId has administrative
   * permissions for institutionId (or is a platform Super Admin / Admin).
   */
  private async assertInstitutionManager(userId: number, institutionId: number) {
    if (!userId || !Number.isInteger(userId) || userId <= 0) {
      throw new UnauthorizedException('User authentication required');
    }

    if (!institutionId || !Number.isInteger(institutionId) || institutionId <= 0) {
      throw new BadRequestException('Invalid institution ID');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        roles: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!user || !user.status) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Platform Super Admin / Admin has universal management access
    const isPlatformAdmin = user.roles?.some((r) => {
      const name = r.name?.toUpperCase();
      const slug = r.slug?.toLowerCase();
      return (
        name === 'SUPER ADMIN' ||
        name === 'ADMIN' ||
        slug === 'super-admin' ||
        slug === 'admin'
      );
    });

    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { id: true, ownerId: true, status: true, name: true },
    });

    if (!institution) {
      throw new NotFoundException('Institution not found');
    }

    if (!institution.status && !isPlatformAdmin) {
      throw new ForbiddenException('Institution is inactive');
    }

    if (isPlatformAdmin) {
      return institution;
    }

    // Institution Owner check
    if (institution.ownerId === userId) {
      return institution;
    }

    // Institution Member ADMIN role check
    const membership = await this.prisma.institutionMember.findUnique({
      where: {
        institutionId_userId: {
          institutionId,
          userId,
        },
      },
      select: { status: true, role: true },
    });

    if (
      !membership ||
      !membership.status ||
      membership.role !== InstitutionMemberRole.ADMIN
    ) {
      throw new ForbiddenException('You cannot manage groups for this institution');
    }

    return institution;
  }

  private async getGroupOrFail(id: number) {
    const group = await this.prisma.group.findUnique({ where: { id } });
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  private async assertInstituteCanAccessGroup(groupId: number, institutionId: number) {
    const group = await this.getGroupOrFail(groupId);

    const canAccess =
      group.type === GroupType.ADMIN_PUBLIC ||
      (group.type === GroupType.INSTITUTION_PRIVATE &&
        group.ownerInstitutionId === institutionId);

    if (!canAccess) {
      throw new ForbiddenException('This group is not available to this institution');
    }

    return group;
  }

  private async assertInstituteCanEditGroup(groupId: number, institutionId: number) {
    const group = await this.getGroupOrFail(groupId);

    if (
      group.type !== GroupType.INSTITUTION_PRIVATE ||
      group.ownerInstitutionId !== institutionId
    ) {
      throw new ForbiddenException('Only your institution private groups can be edited');
    }

    return group;
  }

  private async assertInstituteCanManageMembers(groupId: number, institutionId: number) {
    const group = await this.assertInstituteCanAccessGroup(groupId, institutionId);

    if (
      group.type === GroupType.ADMIN_PUBLIC &&
      !group.allowInstituteManageMembers
    ) {
      throw new ForbiddenException(
        'Institute member management is disabled for this public group',
      );
    }

    return group;
  }

  async createAdmin(dto: CreateAdminGroupDto, adminUserId: number) {
    const type = dto.type ?? GroupType.ADMIN_PUBLIC;

    if (type === GroupType.INSTITUTION_PRIVATE && !dto.ownerInstitutionId) {
      throw new BadRequestException(
        'ownerInstitutionId is required for an institution private group',
      );
    }

    if (type === GroupType.ADMIN_PUBLIC && dto.ownerInstitutionId) {
      throw new BadRequestException(
        'ownerInstitutionId is only allowed for an institution private group',
      );
    }

    if (dto.ownerInstitutionId) {
      await this.validateInstitutionIds([dto.ownerInstitutionId]);
    }

    const institutionIds = await this.validateInstitutionIds(dto.institutionIds);
    const userIds = await this.validateUserIds(dto.userIds);

    if (type === GroupType.INSTITUTION_PRIVATE && institutionIds.length) {
      throw new BadRequestException(
        'Private groups cannot be assigned to other institutions',
      );
    }

    const slug = await this.generateUniqueSlug(dto.name);

    return this.prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          type,
          ownerInstitutionId:
            type === GroupType.INSTITUTION_PRIVATE ? dto.ownerInstitutionId : null,
          createdById: adminUserId,
          allowInstituteManageMembers: dto.allowInstituteManageMembers ?? true,
          status: dto.status ?? true,
        },
      });

      if (type === GroupType.ADMIN_PUBLIC && institutionIds.length) {
        await tx.groupInstitution.createMany({
          data: institutionIds.map((institutionId) => ({
            groupId: group.id,
            institutionId,
            addedById: adminUserId,
          })),
          skipDuplicates: true,
        });
      }

      if (userIds.length) {
        await tx.groupUser.createMany({
          data: userIds.map((userId) => ({
            groupId: group.id,
            userId,
            source: GroupUserSource.ADMIN_MANUAL,
            sourceInstitutionId: null,
            sourceKey: 'ADMIN',
            addedById: adminUserId,
          })),
          skipDuplicates: true,
        });
      }

      return group;
    });
  }

  async createInstitute(
    institutionId: number,
    actorUserId: number,
    dto: CreateInstituteGroupDto,
  ) {
    await this.assertInstitutionManager(actorUserId, institutionId);
    const userIds = await this.validateInstitutionUserIds(institutionId, dto.userIds);
    const slug = await this.generateUniqueSlug(dto.name);

    return this.prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          type: GroupType.INSTITUTION_PRIVATE,
          ownerInstitutionId: institutionId,
          createdById: actorUserId,
          allowInstituteManageMembers: true,
          status: dto.status ?? true,
        },
      });

      if (userIds.length) {
        await tx.groupUser.createMany({
          data: userIds.map((userId) => ({
            groupId: group.id,
            userId,
            source: GroupUserSource.INSTITUTION_MANUAL,
            sourceInstitutionId: institutionId,
            sourceKey: `INSTITUTION:${institutionId}`,
            addedById: actorUserId,
          })),
          skipDuplicates: true,
        });
      }

      return group;
    });
  }

  async findAllAdmin(query: GroupQueryDto) {
    const {
      page = 1,
      limit = 10,
      keyword,
      status,
      type,
      institutionId,
      ownerInstitutionId,
    } = query;

    const skip = (page - 1) * limit;
    const where: Prisma.GroupWhereInput = {};

    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { slug: { contains: keyword } },
        { description: { contains: keyword } },
      ];
    }

    if (status !== undefined) where.status = status;
    if (type !== undefined) where.type = type;
    if (ownerInstitutionId !== undefined) where.ownerInstitutionId = ownerInstitutionId;

    if (institutionId !== undefined) {
      where.AND = [
        {
          OR: [
            { ownerInstitutionId: institutionId },
            { institutions: { some: { institutionId } } },
          ],
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.group.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ownerInstitution: {
            select: { id: true, name: true, logo: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { institutions: true, users: true },
          },
        },
      }),
      this.prisma.group.count({ where }),
    ]);

    return { data, total };
  }

  async findAllForInstitute(
    institutionId: number,
    actorUserId: number,
    query: GroupQueryDto,
  ) {
    await this.assertInstitutionManager(actorUserId, institutionId);

    const { page = 1, limit = 10, keyword, status, type } = query;
    const skip = (page - 1) * limit;

    const baseScope: Prisma.GroupWhereInput = {
      OR: [
        { type: GroupType.ADMIN_PUBLIC },
        {
          type: GroupType.INSTITUTION_PRIVATE,
          ownerInstitutionId: institutionId,
        },
      ],
    };

    const where: Prisma.GroupWhereInput = {
      AND: [
        baseScope,
        ...(keyword
          ? [
              {
                OR: [
                  { name: { contains: keyword } },
                  { slug: { contains: keyword } },
                  { description: { contains: keyword } },
                ],
              } as Prisma.GroupWhereInput,
            ]
          : []),
        ...(status !== undefined ? [{ status }] : []),
        ...(type !== undefined ? [{ type }] : []),
      ],
    };

    const [data, total] = await Promise.all([
      this.prisma.group.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
        include: {
          ownerInstitution: {
            select: { id: true, name: true, logo: true },
          },
          institutions: {
            where: { institutionId },
            select: { id: true, institutionId: true },
          },
          _count: { select: { users: true, institutions: true } },
        },
      }),
      this.prisma.group.count({ where }),
    ]);

    return {
      data: data.map((group) => ({
        ...group,
        isInstitutionAssigned: group.institutions.length > 0,
      })),
      total,
    };
  }

  async findOneAdmin(id: number) {
    const group = await this.prisma.group.findUnique({
      where: { id },
      include: {
        ownerInstitution: {
          select: { id: true, name: true, logo: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        institutions: {
          orderBy: { createdAt: 'desc' },
          include: {
            institution: {
              select: { id: true, name: true, logo: true, status: true },
            },
          },
        },
        _count: { select: { users: true, institutions: true } },
      },
    });

    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  async findOneForInstitute(
    groupId: number,
    institutionId: number,
    actorUserId: number,
  ) {
    await this.assertInstitutionManager(actorUserId, institutionId);
    await this.assertInstituteCanAccessGroup(groupId, institutionId);

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        ownerInstitution: {
          select: { id: true, name: true, logo: true },
        },
        institutions: {
          where: { institutionId },
          select: { id: true, institutionId: true, createdAt: true },
        },
        _count: { select: { users: true } },
      },
    });

    if (!group) throw new NotFoundException('Group not found');

    return {
      ...group,
      isInstitutionAssigned: group.institutions.length > 0,
    };
  }

  async updateAdmin(id: number, dto: UpdateGroupDto) {
    const existing = await this.getGroupOrFail(id);
    let slug = existing.slug;

    if (dto.name && dto.name !== existing.name) {
      slug = await this.generateUniqueSlug(dto.name, id);
    }

    return this.prisma.group.update({
      where: { id },
      data: {
        ...dto,
        slug,
      },
    });
  }

  async updateInstitutePrivate(
    groupId: number,
    institutionId: number,
    actorUserId: number,
    dto: UpdateGroupDto,
  ) {
    await this.assertInstitutionManager(actorUserId, institutionId);
    const existing = await this.assertInstituteCanEditGroup(groupId, institutionId);
    let slug = existing.slug;

    if (dto.name && dto.name !== existing.name) {
      slug = await this.generateUniqueSlug(dto.name, groupId);
    }

    // Institute cannot change the platform-level member-management flag.
    const { allowInstituteManageMembers: _ignored, ...safeDto } = dto;

    return this.prisma.group.update({
      where: { id: groupId },
      data: { ...safeDto, slug },
    });
  }

  async toggleStatusAdmin(id: number) {
    const group = await this.getGroupOrFail(id);
    return this.prisma.group.update({
      where: { id },
      data: { status: !group.status },
    });
  }

  async toggleStatusInstitute(
    groupId: number,
    institutionId: number,
    actorUserId: number,
  ) {
    await this.assertInstitutionManager(actorUserId, institutionId);
    const group = await this.assertInstituteCanEditGroup(groupId, institutionId);

    return this.prisma.group.update({
      where: { id: groupId },
      data: { status: !group.status },
    });
  }

  async removeAdmin(id: number) {
    await this.getGroupOrFail(id);
    return this.prisma.group.update({
      where: { id },
      data: { status: false },
    });
  }

  async removeInstitutePrivate(
    groupId: number,
    institutionId: number,
    actorUserId: number,
  ) {
    await this.assertInstitutionManager(actorUserId, institutionId);
    await this.assertInstituteCanEditGroup(groupId, institutionId);

    return this.prisma.group.update({
      where: { id: groupId },
      data: { status: false },
    });
  }

  async getInstitutions(groupId: number) {
    await this.getGroupOrFail(groupId);

    return this.prisma.groupInstitution.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      include: {
        institution: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            status: true,
            _count: {
              select: { members: true },
            },
          },
        },
      },
    });
  }

  async addInstitutionsAdmin(
    groupId: number,
    institutionIdsInput: number[],
    adminUserId: number,
  ) {
    const group = await this.getGroupOrFail(groupId);

    if (group.type !== GroupType.ADMIN_PUBLIC) {
      throw new BadRequestException(
        'Institutions can only be assigned to ADMIN_PUBLIC groups',
      );
    }

    const institutionIds = await this.validateInstitutionIds(institutionIdsInput);

    await this.prisma.groupInstitution.createMany({
      data: institutionIds.map((institutionId) => ({
        groupId,
        institutionId,
        addedById: adminUserId,
      })),
      skipDuplicates: true,
    });

    return this.getInstitutions(groupId);
  }

  async removeInstitutionAdmin(groupId: number, institutionId: number) {
    await this.getGroupOrFail(groupId);

    const result = await this.prisma.groupInstitution.deleteMany({
      where: { groupId, institutionId },
    });

    if (!result.count) {
      throw new NotFoundException('Institution is not assigned to this group');
    }

    return { removed: true };
  }

  async addUsersAdmin(groupId: number, userIdsInput: number[], adminUserId: number) {
    await this.getGroupOrFail(groupId);
    const userIds = await this.validateUserIds(userIdsInput);

    await this.prisma.groupUser.createMany({
      data: userIds.map((userId) => ({
        groupId,
        userId,
        source: GroupUserSource.ADMIN_MANUAL,
        sourceInstitutionId: null,
        sourceKey: 'ADMIN',
        addedById: adminUserId,
      })),
      skipDuplicates: true,
    });

    return { added: userIds.length };
  }

  async removeUserAdmin(groupId: number, userId: number) {
    await this.getGroupOrFail(groupId);

    const result = await this.prisma.groupUser.deleteMany({
      where: { groupId, userId },
    });

    const stillMember = await this.isEffectiveMember(groupId, userId);

    return {
      removedExplicitSources: result.count,
      stillMember,
      message: stillMember
        ? 'Explicit membership removed, but user is still inherited from an assigned institution.'
        : 'User removed from group.',
    };
  }

  async addUsersFromInstitute(
    groupId: number,
    institutionId: number,
    actorUserId: number,
    userIdsInput: number[],
  ) {
    await this.assertInstitutionManager(actorUserId, institutionId);
    await this.assertInstituteCanManageMembers(groupId, institutionId);
    const userIds = await this.validateInstitutionUserIds(institutionId, userIdsInput);

    await this.prisma.groupUser.createMany({
      data: userIds.map((userId) => ({
        groupId,
        userId,
        source: GroupUserSource.INSTITUTION_MANUAL,
        sourceInstitutionId: institutionId,
        sourceKey: `INSTITUTION:${institutionId}`,
        addedById: actorUserId,
      })),
      skipDuplicates: true,
    });

    return { added: userIds.length };
  }

  async removeUserFromInstitute(
    groupId: number,
    institutionId: number,
    actorUserId: number,
    userId: number,
  ) {
    await this.assertInstitutionManager(actorUserId, institutionId);
    await this.assertInstituteCanManageMembers(groupId, institutionId);

    const result = await this.prisma.groupUser.deleteMany({
      where: {
        groupId,
        userId,
        sourceKey: `INSTITUTION:${institutionId}`,
      },
    });

    const stillMember = await this.isEffectiveMember(groupId, userId);

    return {
      removed: result.count > 0,
      stillMember,
      message: stillMember
        ? 'Institute manual membership removed, but another source still keeps this user in the group.'
        : 'User removed from group.',
    };
  }

  private async linkedInstitutionIds(groupId: number) {
    const links = await this.prisma.groupInstitution.findMany({
      where: { groupId },
      select: { institutionId: true },
    });
    return links.map((item) => item.institutionId);
  }

  private async isEffectiveMember(groupId: number, userId: number) {
    const institutionIds = await this.linkedInstitutionIds(groupId);

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        OR: [
          { groupMemberships: { some: { groupId } } },
          ...(institutionIds.length
            ? [
                {
                  institutionMembers: {
                    some: {
                      institutionId: { in: institutionIds },
                      status: true,
                    },
                  },
                } as Prisma.UserWhereInput,
              ]
            : []),
        ],
      },
      select: { id: true },
    });

    return !!user;
  }

  async getUsers(
    groupId: number,
    query: GroupUserQueryDto,
    restrictInstitutionId?: number,
  ) {
    await this.getGroupOrFail(groupId);

    const { page = 1, limit = 10, keyword } = query;
    const skip = (page - 1) * limit;
    const institutionIds = await this.linkedInstitutionIds(groupId);

    const membershipWhere: Prisma.UserWhereInput = {
      OR: [
        { groupMemberships: { some: { groupId } } },
        ...(institutionIds.length
          ? [
              {
                institutionMembers: {
                  some: {
                    institutionId: { in: institutionIds },
                    status: true,
                  },
                },
              } as Prisma.UserWhereInput,
            ]
          : []),
      ],
    };

    const where: Prisma.UserWhereInput = {
      AND: [
        membershipWhere,
        ...(restrictInstitutionId
          ? [
              {
                institutionMembers: {
                  some: {
                    institutionId: restrictInstitutionId,
                    status: true,
                  },
                },
              } as Prisma.UserWhereInput,
            ]
          : []),
        ...(keyword
          ? [
              {
                OR: [
                  { name: { contains: keyword } },
                  { email: { contains: keyword } },
                  { mobile: { contains: keyword } },
                  { username: { contains: keyword } },
                ],
              } as Prisma.UserWhereInput,
            ]
          : []),
      ],
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          uuid: true,
          name: true,
          email: true,
          mobile: true,
          avatar: true,
          userType: true,
          status: true,
          groupMemberships: {
            where: { groupId },
            select: {
              id: true,
              source: true,
              sourceInstitutionId: true,
              sourceKey: true,
              createdAt: true,
              sourceInstitution: {
                select: { id: true, name: true },
              },
            },
          },
          institutionMembers: {
            where: {
              institutionId: { in: institutionIds },
              status: true,
            },
            select: {
              institutionId: true,
              institution: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const data = users.map((user) => ({
      ...user,
      membershipSources: [
        ...user.groupMemberships.map((membership) => ({
          type: membership.source,
          source: membership.source,
          institution: membership.sourceInstitution,
          removable: restrictInstitutionId
            ? membership.sourceInstitutionId === restrictInstitutionId
            : true,
          sourceKey: membership.sourceKey,
        })),
        ...user.institutionMembers.map((membership) => ({
          type: 'INSTITUTION_INHERITED',
          source: 'INSTITUTION_INHERITED',
          institution: membership.institution,
          removable: false,
          sourceKey: `INHERITED:${membership.institutionId}`,
        })),
      ],
    }));

    return { data, total };
  }

  async getAdminOptions() {
    return this.prisma.group.findMany({
      where: { status: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        ownerInstitutionId: true,
      },
    });
  }

  async getUsersForInstitute(
    groupId: number,
    institutionId: number,
    actorUserId: number,
    query: GroupUserQueryDto,
  ) {
    await this.assertInstitutionManager(actorUserId, institutionId);
    await this.assertInstituteCanAccessGroup(groupId, institutionId);
    return this.getUsers(groupId, query, institutionId);
  }

  async getInstituteOptions(institutionId: number, actorUserId: number) {
    await this.assertInstitutionManager(actorUserId, institutionId);

    return this.prisma.group.findMany({
      where: {
        status: true,
        OR: [
          { type: GroupType.ADMIN_PUBLIC },
          { type: GroupType.INSTITUTION_PRIVATE, ownerInstitutionId: institutionId },
        ],
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        ownerInstitutionId: true,
        allowInstituteManageMembers: true,
      },
    });
  }
}
