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
import { generateUniqueSlugForTable } from 'src/shared/generate-unique-slug-for-table';
import { PaginationDto } from 'src/shared/dto/pagination-dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { CreateOwnedCourseDto } from './dto/create-owned-course.dto';
import { AssignCatalogCourseDto } from './dto/assign-catalog-course.dto';
import {
  CourseAudience,
  InstitutionMemberRole,
  UserType,
} from 'src/generated/prisma/enums';

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
        role: InstitutionMemberRole.ADMIN,
      },
    });
    return { institution, user, institutionUser };
  }

  async getMyInstitutions(userId: number) {
    const { isSuperAdmin } = await this.checkSuperAdmin(userId);

    if (isSuperAdmin) {
      return await this.prisma.institution.findMany({
        where: { status: true },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { members: true, institutionCourses: true } },
        },
        orderBy: { name: 'asc' },
      });
    }

    return await this.prisma.institution.findMany({
      where: {
        status: true,
        OR: [
          { ownerId: userId },
          { members: { some: { userId, status: true } } },
        ],
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { members: true, institutionCourses: true } },
      },
      orderBy: { name: 'asc' },
    });
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

  async getInstitutionOptions(keyword: string) {
    const whereClause: any = { status: true };
    if (keyword) {
      whereClause.name = { contains: keyword };
    }
    return await this.prisma.institution.findMany({
      where: whereClause,
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }

  async getInstitutionDetails(id: number, userId: number) {
    const { isSuperAdmin, institutionId } = await this.checkSuperAdmin(userId);
    if (!isSuperAdmin && institutionId !== id) {
      const isOwnerOrMember = await this.prisma.institution.findFirst({
        where: {
          id,
          OR: [
            { ownerId: userId },
            { members: { some: { userId, status: true } } },
          ],
        },
      });
      if (!isOwnerOrMember) {
        throw new ForbiddenException('Access denied to this institution');
      }
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

  async getInstituteStats(institutionId: number, userId: number) {
    await this.validateInstitutionAccess(institutionId, userId);

    const [
      teachersCount,
      studentsMemberCount,
      enrolledStudentsCount,
      coursesCount,
      ownedCoursesCount,
      institutionCourses,
    ] = await Promise.all([
      // Count actual teachers
      this.prisma.institutionMember.count({
        where: {
          institutionId,
          status: true,
          OR: [
            { role: InstitutionMemberRole.TEACHER },
            { user: { userType: UserType.TEACHER } },
            {
              user: {
                roles: {
                  some: { name: { in: ['TEACHER', 'Teacher', 'Instructor'] } },
                },
              },
            },
          ],
        },
      }),
      // Count student members
      this.prisma.institutionMember.count({
        where: {
          institutionId,
          status: true,
          OR: [
            { role: InstitutionMemberRole.STUDENT },
            { user: { userType: UserType.STUDENT } },
            {
              AND: [
                { role: { not: InstitutionMemberRole.TEACHER } },
                { user: { userType: { not: UserType.TEACHER } } },
                {
                  user: {
                    roles: {
                      none: {
                        name: {
                          in: [
                            'TEACHER',
                            'Teacher',
                            'Instructor',
                            'Institution Owner',
                          ],
                        },
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      }),
      // Count enrollments
      this.prisma.userEnrolledCourse.count({
        where: {
          institutionId,
        },
      }),
      this.prisma.institutionCourse.count({
        where: {
          institutionId,
        },
      }),
      this.prisma.institutionCourse.count({
        where: {
          institutionId,
          course: {
            audience: CourseAudience.SCHOOL,
          },
        },
      }),
      this.prisma.institutionCourse.findMany({
        where: { institutionId },
        include: {
          course: { select: { price: true } },
        },
      }),
    ]);

    const totalSpent = institutionCourses.reduce((sum, ic) => {
      if (ic.source === 'granted') return sum;
      const price = ic.course?.price ? Number(ic.course.price) : 0;
      return sum + price;
    }, 0);

    const studentsCount = Math.max(studentsMemberCount, enrolledStudentsCount);

    return {
      teachersCount,
      studentsCount,
      coursesCount,
      ownedCoursesCount,
      totalSpent,
    };
  }

  async getEnrollmentTrend(institutionId: number, userId: number) {
    await this.validateInstitutionAccess(institutionId, userId);

    const months: { month: string; start: Date; end: Date }[] = [];
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(
        d.getFullYear(),
        d.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      months.push({
        month: monthNames[d.getMonth()],
        start: d,
        end,
      });
    }

    const trend = await Promise.all(
      months.map(async (m) => {
        const [students, teachers] = await Promise.all([
          this.prisma.institutionMember.count({
            where: {
              institutionId,
              status: true,
              OR: [
                { role: InstitutionMemberRole.STUDENT },
                { user: { userType: UserType.STUDENT } },
              ],
              joinedAt: {
                gte: m.start,
                lte: m.end,
              },
            },
          }),
          this.prisma.institutionMember.count({
            where: {
              institutionId,
              status: true,
              OR: [
                { role: InstitutionMemberRole.TEACHER },
                { user: { userType: UserType.TEACHER } },
              ],
              joinedAt: {
                gte: m.start,
                lte: m.end,
              },
            },
          }),
        ]);

        return {
          month: m.month,
          students,
          teachers,
        };
      }),
    );

    return trend;
  }

  async getPerformanceAnalytics(institutionId: number, userId: number) {
    await this.validateInstitutionAccess(institutionId, userId);

    const quizAttempts = await this.prisma.quizAttempt.findMany({
      where: {
        user: {
          userEnrolledCourses: {
            some: { institutionId },
          },
        },
      },
      include: {
        quiz: {
          include: {
            subjectQuizzes: {
              include: {
                subject: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    const subjectMap = new Map<
      string,
      { title: string; totalScore: number; count: number }
    >();

    for (const qa of quizAttempts) {
      const subName = qa.quiz?.subjectQuizzes?.[0]?.subject?.name || 'General';
      const totalMarks = Number(qa.totalMarks) || 100;
      const obtainedMarks = Number(qa.obtainedMarks) || 0;
      const percentage =
        totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 100) : 0;

      const entry = subjectMap.get(subName) || {
        title: subName,
        totalScore: 0,
        count: 0,
      };
      entry.totalScore += percentage;
      entry.count += 1;
      subjectMap.set(subName, entry);
    }

    const performance: { subject: string; avg: number }[] = [];
    subjectMap.forEach((entry) => {
      if (entry.count > 0) {
        const avg = Math.round(entry.totalScore / entry.count);
        performance.push({ subject: entry.title, avg });
      }
    });

    return performance;
  }

  async getCourseMix(institutionId: number, userId: number) {
    await this.validateInstitutionAccess(institutionId, userId);

    const [grantedCount, purchasedCount, ownedCount] = await Promise.all([
      this.prisma.institutionCourse.count({
        where: {
          institutionId,
          source: 'granted',
        },
      }),
      this.prisma.institutionCourse.count({
        where: {
          institutionId,
          source: 'purchased',
        },
      }),
      this.prisma.institutionCourse.count({
        where: {
          institutionId,
          source: 'owned',
        },
      }),
    ]);

    const result: { name: string; value: number }[] = [];
    result.push({ name: 'Granted', value: grantedCount });
    result.push({ name: 'Purchased', value: purchasedCount });
    result.push({ name: 'Created', value: ownedCount });

    return result;
  }

  async getTeachers(
    institutionId: number,
    paginationDto: PaginationDto,
    userId: number,
  ) {
    await this.validateInstitutionAccess(institutionId, userId);

    const { page = 1, limit = 10, keyword } = paginationDto;
    const skip = (page - 1) * limit;

    // Filter ONLY members who are teachers (or admins)
    const whereClause: any = {
      institutionId,
      status: true,
      OR: [
        { role: InstitutionMemberRole.TEACHER },
        { role: InstitutionMemberRole.ADMIN },
        { user: { userType: UserType.TEACHER } },
        {
          user: {
            roles: {
              some: { name: { in: ['TEACHER', 'Teacher', 'Instructor'] } },
            },
          },
        },
      ],
    };

    if (keyword) {
      whereClause.AND = [
        {
          OR: [
            { user: { name: { contains: keyword } } },
            { user: { email: { contains: keyword } } },
            { user: { mobile: { contains: keyword } } },
          ],
        },
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
              mobile: true,
              classGrade: true,
              roles: { select: { name: true } },
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.institutionMember.count({ where: whereClause }),
    ]);

    const data = members.map((m) => {
      let designation = 'Teacher';
      if (m.role === InstitutionMemberRole.ADMIN) {
        designation = 'Admin';
      } else if (m.role === InstitutionMemberRole.TEACHER) {
        designation = 'Teacher';
      } else if (m.user?.roles?.length) {
        designation = m.user.roles[0].name;
      }

      return {
        id: m.id,
        userId: m.userId,
        name: m.user?.name || `User #${m.userId}`,
        email: m.user?.email || '—',
        mobile: m.user?.mobile || '—',
        designation,
        status: m.status ? 'active' : 'inactive',
        joinedAt: m.joinedAt,
      };
    });

    return { data, total, page, limit };
  }

  async getStudents(
    institutionId: number,
    paginationDto: PaginationDto,
    userId: number,
  ) {
    await this.validateInstitutionAccess(institutionId, userId);

    const { page = 1, limit = 10, keyword, grade, courseId } = paginationDto;
    const skip = (page - 1) * limit;

    // Filter student members
    const whereClause: any = {
      institutionId,
      status: true,
      OR: [
        { role: InstitutionMemberRole.STUDENT },
        { user: { userType: UserType.STUDENT } },
        {
          AND: [
            { role: { not: InstitutionMemberRole.TEACHER } },
            { user: { userType: { not: UserType.TEACHER } } },
            {
              user: {
                roles: {
                  none: {
                    name: {
                      in: [
                        'TEACHER',
                        'Teacher',
                        'Instructor',
                        'Institution Owner',
                      ],
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    };

    if (grade) {
      whereClause.user = {
        ...(whereClause.user || {}),
        classGrade: grade,
      };
    }

    if (courseId) {
      whereClause.user = {
        ...(whereClause.user || {}),
        userEnrolledCourses: {
          some: { courseId, institutionId },
        },
      };
    }

    if (keyword) {
      whereClause.AND = [
        {
          OR: [
            { user: { name: { contains: keyword } } },
            { user: { email: { contains: keyword } } },
            { user: { mobile: { contains: keyword } } },
          ],
        },
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
              mobile: true,
              avatar: true,
              classGrade: true,
              userEnrolledCourses: {
                where: { institutionId },
                include: {
                  course: {
                    select: { id: true, title: true, grade: true },
                  },
                },
                take: 1,
              },
              xpEarned: {
                select: { id: true },
              },
              quizAttempts: {
                select: {
                  id: true,
                  obtainedMarks: true,
                  totalMarks: true,
                },
              },
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.institutionMember.count({ where: whereClause }),
    ]);

    const data = members.map((m) => {
      const attempts = m.user?.quizAttempts || [];
      const xpCount = m.user?.xpEarned?.length || 0;
      const attemptsCount = attempts.length;

      let progress = 0;
      if (attemptsCount > 0) {
        const totalPercentage = attempts.reduce((sum, a) => {
          const total = Number(a.totalMarks) || 100;
          const obtained = Number(a.obtainedMarks) || 0;
          return sum + (total > 0 ? (obtained / total) * 100 : 0);
        }, 0);
        progress = Math.min(100, Math.round(totalPercentage / attemptsCount));
      } else if (xpCount > 0) {
        progress = Math.min(100, xpCount * 10);
      }

      const firstEnrolled = m.user?.userEnrolledCourses?.[0];

      return {
        id: `s-${m.id}`,
        memberId: m.id,
        userId: m.userId,
        name: m.user?.name || `Student #${m.userId}`,
        email: m.user?.email || '—',
        mobile: m.user?.mobile || '—',
        grade: m.user?.classGrade || firstEnrolled?.course?.grade || '—',
        course: firstEnrolled?.course?.title || '—',
        courseId: firstEnrolled?.course?.id || 0,
        progress,
        joinedAt: m.joinedAt,
      };
    });

    return { data, total, page, limit };
  }

  async getAssignedCourses(
    institutionId: number,
    paginationDto: PaginationDto,
    userId: number,
  ) {
    await this.validateInstitutionAccess(institutionId, userId);

    const { page = 1, limit = 10, keyword } = paginationDto;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      institutionId,
    
    };

    if (keyword) {
      whereClause.course.title = { contains: keyword };
    }

    const [records, total] = await Promise.all([
      this.prisma.institutionCourse.findMany({
        where: whereClause,
        include: {
          course: {
            select: {
              id: true,
              title: true,
              thumbnail: true,
              grade: true,
              price: true,
              duration: true,
              _count: {
                select: {
                  userEnrolledCourses: {
                    where: { institutionId },
                  },
                },
              },
            },
          },
        },
        orderBy: { purchasedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.institutionCourse.count({ where: whereClause }),
    ]);

    const data = records.map((r) => ({
      id: r.courseId,
      institutionCourseId: r.id,
      title: r.course.title,
      thumbnail: r.course.thumbnail,
      grade: r.course.grade,
      duration: r.course.duration,
      price: Number(r.course.price) || 0,
      source: r.source || 'granted',
      seats: r.seats,
      enrolledMembers: r.course._count?.userEnrolledCourses || 0,
      purchasedAt: r.purchasedAt,
    }));

    return { data, total, page, limit };
  }

  async assignCatalogCourse(
    institutionId: number,
    userId: number,
    dto: AssignCatalogCourseDto,
  ) {
    await this.validateInstitutionAccess(institutionId, userId);

    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
    });
    if (!course) throw new NotFoundException('Course not found');

    const existing = await this.prisma.institutionCourse.findUnique({
      where: {
        institutionId_courseId: { institutionId, courseId: dto.courseId },
      },
    });
    if (existing) {
      throw new ConflictException(
        'Course is already assigned to this institution',
      );
    }

    const source = dto.source || 'granted';

    return await this.prisma.institutionCourse.create({
      data: {
        institutionId,
        courseId: dto.courseId,
        source,
        seats: dto.seats ?? null,
      },
      include: {
        course: {
          select: { id: true, title: true, price: true, thumbnail: true },
        },
      },
    });
  }

  async removeAssignedCourse(
    institutionId: number,
    userId: number,
    courseId: number,
  ) {
    await this.validateInstitutionAccess(institutionId, userId);

    const record = await this.prisma.institutionCourse.findUnique({
      where: {
        institutionId_courseId: { institutionId, courseId },
      },
    });
    if (!record) {
      throw new NotFoundException(
        'Assigned course not found for this institution',
      );
    }

    return await this.prisma.institutionCourse.delete({
      where: {
        institutionId_courseId: { institutionId, courseId },
      },
    });
  }

  async getAvailableCatalogCourses(
    institutionId: number,
    userId: number,
    keyword?: string,
  ) {
    await this.validateInstitutionAccess(institutionId, userId);

    const assigned = await this.prisma.institutionCourse.findMany({
      where: { institutionId },
      select: { courseId: true },
    });
    const assignedIds = assigned.map((a) => a.courseId);

    const whereClause: any = {
      status: true,
      audience: { not: CourseAudience.SCHOOL },
      ...(assignedIds.length ? { id: { notIn: assignedIds } } : {}),
    };

    if (keyword) {
      whereClause.title = { contains: keyword };
    }

    return await this.prisma.course.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        price: true,
        grade: true,
        thumbnail: true,
      },
      orderBy: { title: 'asc' },
      take: 50,
    });
  }

  async getOwnedCourses(
    institutionId: number,
    paginationDto: PaginationDto,
    userId: number,
  ) {
    await this.validateInstitutionAccess(institutionId, userId);

    const { page = 1, limit = 10, keyword, grade } = paginationDto;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      institutionId,
      course: {
        audience: { in: [CourseAudience.SCHOOL, CourseAudience.PUBLIC] },
      },
    };

    if (keyword) {
      whereClause.course.title = { contains: keyword };
    }
    if (grade) {
      whereClause.course.grade = grade;
    }

    const [records, total] = await Promise.all([
      this.prisma.institutionCourse.findMany({
        where: whereClause,
        include: {
          course: {
            select: {
              id: true,
              title: true,
              description: true,
              thumbnail: true,
              grade: true,
              duration: true,
              price: true,
              audience: true,
              status: true,
              createdAt: true,
              _count: {
                select: {
                  userEnrolledCourses: {
                    where: { institutionId },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.institutionCourse.count({ where: whereClause }),
    ]);

    const data = records.map((r) => ({
      id: r.courseId,
      institutionCourseId: r.id,
      title: r.course.title,
      description: r.course.description,
      grade: r.course.grade || 'All',
      duration: r.course.duration,
      price: Number(r.course.price) || 0,
      visibility:
        r.course.audience === CourseAudience.PUBLIC ? 'public' : 'private',
      enrolledCount: r.course._count?.userEnrolledCourses || 0,
      createdAt: r.course.createdAt,
    }));

    return { data, total, page, limit };
  }

  async createOwnedCourse(
    institutionId: number,
    userId: number,
    dto: CreateOwnedCourseDto,
  ) {
    await this.validateInstitutionAccess(institutionId, userId);

    const slug = await generateUniqueSlugForTable(
      this.prisma,
      'course',
      dto.title,
    );
    const audience =
      dto.visibility === 'public'
        ? CourseAudience.PUBLIC
        : CourseAudience.SCHOOL;

    const course = await this.prisma.course.create({
      data: {
        title: dto.title,
        slug,
        description: dto.description || '',
        thumbnail: dto.thumbnail || '/placeholder.svg',
        grade: dto.grade || 'X',
        audience,
        duration: dto.duration || 'Self-paced',
        price: dto.price ?? 0,
        discountedPrice: dto.price ?? 0,
        status: true,
      },
    });

    const institutionCourse = await this.prisma.institutionCourse.create({
      data: {
        institutionId,
        courseId: course.id,
        source: 'owned',
      },
    });

    return {
      id: course.id,
      institutionCourseId: institutionCourse.id,
      title: course.title,
      description: course.description,
      grade: course.grade,
      duration: course.duration,
      price: Number(course.price) || 0,
      visibility:
        course.audience === CourseAudience.PUBLIC ? 'public' : 'private',
      enrolledCount: 0,
      createdAt: course.createdAt,
    };
  }

  async updateOwnedCourseVisibility(
    institutionId: number,
    userId: number,
    courseId: number,
    visibility: 'public' | 'private',
  ) {
    await this.validateInstitutionAccess(institutionId, userId);

    const record = await this.prisma.institutionCourse.findUnique({
      where: {
        institutionId_courseId: { institutionId, courseId },
      },
    });
    if (!record) {
      throw new NotFoundException('Course not found in this institution');
    }

    const audience =
      visibility === 'public' ? CourseAudience.PUBLIC : CourseAudience.SCHOOL;
    const updated = await this.prisma.course.update({
      where: { id: courseId },
      data: { audience },
    });

    return {
      id: updated.id,
      visibility:
        updated.audience === CourseAudience.PUBLIC ? 'public' : 'private',
    };
  }

  async deleteOwnedCourse(
    institutionId: number,
    userId: number,
    courseId: number,
  ) {
    await this.validateInstitutionAccess(institutionId, userId);

    const record = await this.prisma.institutionCourse.findUnique({
      where: {
        institutionId_courseId: { institutionId, courseId },
      },
    });
    if (!record) {
      throw new NotFoundException('Course not found in this institution');
    }

    await this.prisma.institutionCourse.delete({
      where: {
        institutionId_courseId: { institutionId, courseId },
      },
    });

    return await this.prisma.course.delete({
      where: { id: courseId },
    });
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
    await this.validateInstitutionAccess(institutionId, requesterId);

    const hashedPassword = await bcrypt.hash(dto.password || 'Temp1234!', 10);

    const roleUpper = (dto.role || dto.designation || '').toUpperCase();
    const memberRole =
      roleUpper === 'ADMIN'
        ? InstitutionMemberRole.ADMIN
        : roleUpper === 'STUDENT'
          ? InstitutionMemberRole.STUDENT
          : InstitutionMemberRole.TEACHER;

    const userType =
      roleUpper === 'STUDENT' ? UserType.STUDENT : UserType.TEACHER;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        mobile: dto.phone || dto.mobile,
        classGrade: dto.level,
        userType,
        password: hashedPassword,
        status: dto.status !== undefined ? dto.status : true,
        roles: dto?.roles?.length
          ? {
              connect: dto.roles.map((id) => ({ id })),
            }
          : undefined,
      },
    });

    return this.prisma.institutionMember.create({
      data: {
        institutionId,
        userId: user.id,
        role: memberRole,
        status: dto.status !== undefined ? dto.status : true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            status: true,
          },
        },
      },
    });
  }

  async updateMember(
    institutionId: number,
    memberId: number,
    requesterId: number,
    dto: UpdateMemberDto,
  ) {
    await this.validateInstitutionAccess(institutionId, requesterId);

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

    let hashedPassword: string | undefined;
    if (dto.password && dto.password.trim() !== '') {
      hashedPassword = await bcrypt.hash(dto.password, 10);
    }

    const roleUpper = (dto.role || dto.designation || '').toUpperCase();
    let memberRole: InstitutionMemberRole | undefined = undefined;
    if (roleUpper === 'ADMIN') memberRole = InstitutionMemberRole.ADMIN;
    else if (roleUpper === 'STUDENT')
      memberRole = InstitutionMemberRole.STUDENT;
    else if (roleUpper === 'TEACHER')
      memberRole = InstitutionMemberRole.TEACHER;

    const userUpdateData: any = {};
    if (dto.email !== undefined) userUpdateData.email = dto.email;
    if (dto.name !== undefined) userUpdateData.name = dto.name;
    if (dto.phone !== undefined || dto.mobile !== undefined) {
      userUpdateData.mobile = dto.phone || dto.mobile;
    }
    if (dto.level !== undefined) userUpdateData.classGrade = dto.level;
    if (dto.status !== undefined) userUpdateData.status = dto.status;
    if (hashedPassword) userUpdateData.password = hashedPassword;
    if (dto.roles) {
      userUpdateData.roles = {
        set: dto.roles.map((id) => ({ id })),
      };
    }
    if (memberRole) {
      userUpdateData.userType =
        memberRole === InstitutionMemberRole.STUDENT
          ? UserType.STUDENT
          : UserType.TEACHER;
    }

    if (Object.keys(userUpdateData).length > 0) {
      await this.prisma.user.update({
        where: { id: member.userId },
        data: userUpdateData,
      });
    }

    const memberUpdateData: any = {};
    if (memberRole) memberUpdateData.role = memberRole;
    if (dto.status !== undefined) memberUpdateData.status = dto.status;

    if (Object.keys(memberUpdateData).length > 0) {
      await this.prisma.institutionMember.update({
        where: { id: memberId },
        data: memberUpdateData,
      });
    }

    return await this.prisma.institutionMember.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            status: true,
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
    await this.validateInstitutionAccess(institutionId, requesterId);

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
    await this.validateInstitutionAccess(institutionId, requesterId);

    const { role = null, page = 1, limit = 10, keyword = null } = paginationDto;
    const skip = (page - 1) * limit;
    const whereClause: any = { institutionId, status: true };

    if (role) {
      whereClause.user = { roles: { some: { name: role } } };
    }
    if (keyword) {
      whereClause.AND = [
        {
          OR: [
            { user: { name: { contains: keyword } } },
            { user: { email: { contains: keyword } } },
            { user: { mobile: { contains: keyword } } },
          ],
        },
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
    await this.validateInstitutionAccess(institutionId, requesterId);

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
    await this.validateInstitutionAccess(institutionId, requesterId);

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

  async validateInstitutionAccess(institutionId: number, userId: number) {
    const { isSuperAdmin, institutionId: userInstitutionId } =
      await this.checkSuperAdmin(userId);
    if (isSuperAdmin) return true;
    if (userInstitutionId === institutionId) return true;

    const access = await this.prisma.institution.findFirst({
      where: {
        id: institutionId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId, status: true } } },
        ],
      },
    });

    if (!access) {
      throw new ForbiddenException('Access denied to this institution');
    }
    return true;
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
        ownedInstitutions: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const roleNames = user.roles.map((r) => r.name.toUpperCase());
    const isSuperAdmin = roleNames.includes('SUPER ADMIN');

    if (isSuperAdmin) {
      return { isSuperAdmin: true };
    }

    const institutionId =
      user.ownedInstitutions?.[0]?.id ||
      user.institutionMembers?.[0]?.institutionId;

    return {
      isSuperAdmin: false,
      ...(institutionId && { institutionId }),
    };
  }
}
