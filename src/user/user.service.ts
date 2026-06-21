import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Course, User, UserType } from 'src/generated/prisma/browser';
import { PaginationDto } from 'src/shared/dto/pagination-dto';
import * as ExcelJS from 'exceljs';
import { take } from 'rxjs/internal/operators/take';

interface Badge {
  id: string;
  name: string;
  description: string;
  earnedAt: Date;
}
const IMPORT_COLUMNS = [
  { header: 'Name', key: 'name', width: 24 },
  { header: 'Class', key: 'classGrade', width: 10 },
  { header: 'Section', key: 'section', width: 10 },
  { header: 'Roll No', key: 'rollNo', width: 10 },
  { header: 'Contact No.', key: 'mobile', width: 16 },
  { header: 'Institute Id', key: 'instituteId', width: 14 },
] as const;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(
    email: string,
    password: string,
    mobileNumber: string,
    mobilePrefix: string,
    name?: string,
    classGrade?: string,
    userType?: UserType,
    institutionId?: number,
    roles?: number[],
    schoolName?: string,
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new BadRequestException('Email already in use');
    }
    const existingUserWithMobile = await this.prisma.user.findUnique({
      where: { mobile: mobileNumber },
    });
    if (existingUserWithMobile) {
      throw new BadRequestException('Mobile Number Already taken');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        classGrade,
        userType: userType ?? UserType.STUDENT,
        mobile_prefix: mobilePrefix,
        mobile: mobileNumber,
        schoolName,
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
        userType: true,
        roles: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
      },
    });
    if (institutionId) {
      await this.prisma.institutionMember.create({
        data: {
          userId: user.id,
          institutionId: institutionId,
        },
      });
    }

    return user;
  }
  async findByMobileNumber(mobileNumber: string) {
    return this.prisma.user.findUnique({
      where: { mobile: mobileNumber },
    });
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
          userType: true,
          status: true,
          createdAt: true,
          mobile: true,
          mobile_prefix: true,
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
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        uuid: true,
        email: true,
        name: true,
        username: true,
        classGrade: true,
        userType: true,
        status: true,
        password: true,
        createdAt: true,
        roles: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findById(id: number) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
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
      userType?: UserType;
      roles?: number[];
      status?: boolean;
      mobileNumber: string;
      mobilePrefix: string;
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
        where: { email: data.email, ...(id !== undefined && { NOT: { id } }) },
      });

      if (emailExists) {
        throw new BadRequestException('Email already in use');
      }
    }
    const mobileExists = await this.prisma.user.findUnique({
      where: {
        mobile: data.mobileNumber,
        ...(id !== undefined && { NOT: { id } }),
      },
    });

    if (mobileExists) {
      throw new BadRequestException('Mobile Number already in use');
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
        userType: data.userType,
        status: data.status,
        password: hashedPassword,
        mobile: data.mobileNumber,
        mobile_prefix: data.mobilePrefix,
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
        userType: true,
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

  async resetPasswordUsingMobile(
    mobile: string,
    mobilePrefix: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { mobile: mobile, mobile_prefix: mobilePrefix },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updatedUser = await this.prisma.user.update({
      where: { mobile: mobile, mobile_prefix: mobilePrefix },
      data: { password: hashedPassword },
    });
    return { ...updatedUser, newPassword, hashedPassword };
  }

  async getTeachers() {
    return await this.prisma.user.findMany({
      where: {
        roles: {
          some: {
            name: 'teacher',
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });
  }

  async getUserProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        uuid: true,
        email: true,
        name: true,
        username: true,
        classGrade: true,
        userType: true,
        dateOfBirth: true,
        avatar: true,
        about: true,
        mobile: true,
        mobile_prefix: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        roles: {
          select: {
            id: true,
            name: true,
          },
        },
        userEnrolledCourses: {
          select: {
            id: true,
            courseId: true,
            enrolledAt: true,
            course: {
              select: {
                id: true,
                title: true,
                slug: true,
              },
            },
          },
        },
        xpEarned: {
          select: {
            id: true,
            xpPoints: true,
            createdAt: true,
            lesson: {
              select: {
                id: true,
                title: true,
              },
            },
            quiz: {
              select: {
                id: true,
                title: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            status: true,
            createdAt: true,
            course: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Calculate total XP and level
    const totalXP = user.xpEarned.reduce((sum, xp) => sum + xp.xpPoints, 0);
    const level = Math.floor(totalXP / 1000) + 1;

    return {
      ...user,
      totalXP,
      level,
    };
  }

  async getUserLeaderboard(user: User, courseId: number) {
    const enrolledCourse = await this.prisma.userEnrolledCourse.findFirst({
      where: {
        userId: user.id,
        courseId,
      },
    });

    if (!enrolledCourse) {
      throw new NotFoundException('User not enrolled in this course');
    }

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
      },
    });

    // Get all students in the course with their quiz performance
    const studentsInCourse = await this.prisma.userEnrolledCourse.findMany({
      where: { courseId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Get quiz attempts for each student
    const leaderboardData = await Promise.all(
      studentsInCourse.map(async (enrollment) => {
        const quizAttempts = await this.prisma.quizAttempt.findMany({
          where: { userId: enrollment.user.id },
        });

        const totalScore = quizAttempts.reduce(
          (sum, attempt) => sum + Number(attempt.obtainedMarks),
          0,
        );
        const totalAttempts = quizAttempts.length;
        const averageScore =
          totalAttempts > 0 ? Math.round(totalScore / totalAttempts) : 0;

        return {
          userId: enrollment.user.id,
          name: enrollment.user.name,
          email: enrollment.user.email,
          totalScore,
          completedChapters: 0, // placeholder - would need to track lesson completion
          averageTime: 0, // placeholder - would need to track time spent
          averageScore,
          totalAttempts,
        };
      }),
    );

    // Sort by score and assign ranks
    const sorted = leaderboardData.sort((a, b) => b.totalScore - a.totalScore);
    const rankedLeaderboard = sorted.map((student, index) => ({
      ...student,
      rank: index + 1,
    }));

    return {
      courseId,
      courseName: course?.title,
      students: rankedLeaderboard,
    };
  }
  async getUserPerformanceReport(userId: number, courseId?: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let courses: any[] = [];
    if (courseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
      });
      if (course) {
        courses = [course];
      }
    } else {
      const enrolledCourses = await this.prisma.userEnrolledCourse.findMany({
        where: { userId },
        include: {
          course: true,
        },
      });
      courses = enrolledCourses.map((ec) => ec.course);
    }

    // Get all subject reports with actual difficulty breakdown
    const subjectReports = await Promise.all(
      courses.flatMap(async (course) => {
        // Get subjects for this course only
        const courseSubjects = await this.prisma.courseSubject.findMany({
          where: { courseId: course.id },
          include: {
            subject: {
              include: {
                chapters: {
                  include: {
                    chapter: {
                      include: {
                        lessons: {
                          include: {
                            lesson: {
                              include: {
                                quizzes: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });

        return Promise.all(
          courseSubjects.map(async (cs) => {
            const subject = cs.subject;
            const chapterReports = await Promise.all(
              subject.chapters.map(async (sc) => {
                const chapter = sc.chapter;
                const lessons = chapter.lessons.map((lc) => lc.lesson);

                let totalCorrect = 0;
                let totalAttempted = 0;
                let timeSpent = 0;

                // Initialize difficulty breakdown
                const difficultyBreakdown = {
                  easy: { attempted: 0, correct: 0 },
                  medium: { attempted: 0, correct: 0 },
                  hard: { attempted: 0, correct: 0 },
                };

                for (const lesson of lessons) {
                  const quizzes = lesson.quizzes;
                  for (const quiz of quizzes) {
                    // Get attempts with question details for difficulty breakdown
                    const attempts = await this.prisma.quizAttempt.findMany({
                      where: {
                        userId,
                        quizId: quiz.id,
                      },
                      include: {
                        answers: {
                          include: {
                            question: true, // Include question to get difficulty
                          },
                        },
                      },
                    });

                    attempts.forEach((attempt) => {
                      totalCorrect += attempt.correctAnswers;
                      totalAttempted += attempt.totalQuestions;
                      timeSpent += attempt.timeTaken || 0;

                      // Aggregate by difficulty
                      attempt.answers.forEach((answer) => {
                        const difficulty = answer.question
                          .difficulty as keyof typeof difficultyBreakdown;
                        if (difficultyBreakdown[difficulty]) {
                          difficultyBreakdown[difficulty].attempted += 1;
                          if (answer.isCorrect) {
                            difficultyBreakdown[difficulty].correct += 1;
                          }
                        }
                      });
                    });
                  }
                }

                return {
                  chapterId: chapter.id,
                  chapterName: chapter.title,
                  timeSpent,
                  questionsAttempted: totalAttempted,
                  correctAnswers: totalCorrect,
                  difficultyBreakdown,
                };
              }),
            );

            return {
              subjectId: subject.id,
              subjectName: subject.name,
              averageDifficulty: 'medium',
              totalTimeSpent: chapterReports.reduce(
                (sum, cr) => sum + cr.timeSpent,
                0,
              ),
              chapterReports,
            };
          }),
        );
      }),
    );

    const flattenedReports = subjectReports.flat();

    // Calculate overall progress based on chapters started vs total chapters
    const totalChapters = flattenedReports.reduce(
      (sum, subject) => sum + subject.chapterReports.length,
      0,
    );

    const completedChapters = flattenedReports.reduce(
      (sum, subject) =>
        sum +
        subject.chapterReports.filter((ch) => ch.questionsAttempted > 0).length,
      0,
    );

    const overallProgress =
      totalChapters > 0
        ? Math.round((completedChapters / totalChapters) * 100)
        : 0;

    return {
      userId,
      courseId: courseId || null,
      subjectReports: flattenedReports,
      overallProgress,
    };
  }

  async getUserBadges(userId: number) {
    // Mock badges based on XP and achievements
    const user = await this.getUserProfile(userId);

    const badges: Badge[] = [];

    // Award badges based on XP
    if (user.totalXP >= 100) {
      badges.push({
        id: 'first-steps',
        name: 'First Steps',
        description: 'Earned 100 XP',
        earnedAt: user.createdAt,
      });
    }
    if (user.totalXP >= 500) {
      badges.push({
        id: 'quick-learner',
        name: 'Quick Learner',
        description: 'Earned 500 XP',
        earnedAt: new Date(),
      });
    }
    if (user.totalXP >= 1000) {
      badges.push({
        id: 'week-warrior',
        name: 'Week Warrior',
        description: 'Earned 1000 XP',
        earnedAt: new Date(),
      });
    }
    if (user.totalXP >= 2000) {
      badges.push({
        id: 'chapter-master',
        name: 'Chapter Master',
        description: 'Earned 2000 XP',
        earnedAt: new Date(),
      });
    }
    if (user.level >= 5) {
      badges.push({
        id: 'test-ace',
        name: 'Test Ace',
        description: 'Reached Level 5',
        earnedAt: new Date(),
      });
    }

    // Get quiz attempts to count perfect scores
    const quizAttempts = await this.prisma.quizAttempt.findMany({
      where: { userId },
    });

    const perfectScores = quizAttempts.filter(
      (attempt) => Number(attempt.obtainedMarks) === Number(attempt.totalMarks),
    ).length;

    if (perfectScores >= 3) {
      badges.push({
        id: 'perfect-score',
        name: 'Perfect Score',
        description: 'Achieved 3 perfect quiz scores',
        earnedAt: new Date(),
      });
    }

    return badges;
  }

  async getUserCertificates(userId: number) {
    const enrolledCourses = await this.prisma.userEnrolledCourse.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Mock certificates - in real app, would store actual completion status
    const certificates = enrolledCourses
      .filter((_, index) => index < 2) // Show first 2 as completed
      .map((enrollment) => ({
        id: `cert-${enrollment.id}`,
        courseName: enrollment.course.title,
        courseId: enrollment.course.id,
        issuedAt: enrollment.enrolledAt,
      }));

    return certificates;
  }

  async generateSampleXlsx(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Users Import');
    ws.columns = IMPORT_COLUMNS.map((c) => ({ ...c }));

    const headerRow = ws.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell: any) => {
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
        name: 'Arial',
        size: 11,
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A5F' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = this.thinBorder();
    });

    // Sample rows
    const samples = [
      {
        name: 'AARAV SHAW',
        classGrade: 'VI',
        section: 'A',
        rollNo: '01',
        mobile: '6290582060',
        instituteId: 1,
      },
      {
        name: 'PRIYA MEHTA',
        classGrade: 'VII',
        section: 'B',
        rollNo: '02',
        mobile: '9876543210',
        instituteId: 1,
      },
      {
        name: 'RAHUL KUMAR',
        classGrade: 'VIII',
        section: 'C',
        rollNo: '03',
        mobile: '8123456789',
        instituteId: 2,
      },
    ];
    samples.forEach((s, i) => {
      const row = ws.addRow(s);
      row.height = 22;
      row.eachCell((cell: any) => {
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = this.thinBorder();
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: i % 2 === 0 ? 'FFF0F4FA' : 'FFFFFFFF' },
        };
      });
    });

    const wi = wb.addWorksheet('Instructions');
    wi.getColumn(1).width = 62;
    const lines: [string, boolean][] = [
      ['User Import – Instructions', true],
      ['', false],
      ['Required Columns:', true],
      ['  Name         Full name (e.g. AARAV SHAW)', false],
      ['  Class        Grade/Class (e.g. VI, VII, VIII)', false],
      ['  Section      Section letter (e.g. A, B, C)', false],
      ['  Roll No      Roll number (e.g. 01, 02)', false],
      ['  Contact No.  10-digit mobile without prefix', false],
      ['  Institute Id Numeric institution ID', false],
      ['', false],
      ['Notes:', true],
      ['  • Password is auto-generated: FirstName@123', false],
      ['  • Download the result file after import to get passwords', false],
      ['  • Do NOT modify column headers', false],
      ['  • Delete sample rows before uploading', false],
    ];
    lines.forEach(([text, bold], i) => {
      const cell = wi.getCell(i + 1, 1);
      cell.value = text;
      cell.font = { bold, name: 'Arial', size: 11 };
      if (i === 0) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E3A5F' },
        };
        cell.font = {
          bold: true,
          color: { argb: 'FFFFFFFF' },
          name: 'Arial',
          size: 12,
        };
      }
      wi.getRow(i + 1).height = 20;
    });

    return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async exportUsersXlsx(keyword?: string): Promise<Buffer> {
    const where = keyword
      ? {
          OR: [
            { name: { contains: keyword, mode: 'insensitive' as const } },
            { email: { contains: keyword, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const users = await this.prisma.user.findMany({
      where,
      include: {
        roles: true,
        institutionMembers: { include: { institution: true } },
      },
      orderBy: { id: 'asc' },
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Users');

    ws.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Name', key: 'name', width: 22 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Mobile', key: 'mobile', width: 16 },
      { header: 'Class', key: 'classGrade', width: 10 },
      { header: 'Section', key: 'section', width: 10 },
      { header: 'Roll No', key: 'rollNo', width: 10 },
      { header: 'Roles', key: 'roles', width: 22 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Created At', key: 'createdAt', width: 20 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
        name: 'Arial',
        size: 11,
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A5F' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = this.thinBorder();
    });

    users.forEach((u, i) => {
      const row = ws.addRow({
        id: u.id,
        name: u.name ?? '',
        email: u.email ?? '',
        mobile: u.mobile ?? '',
        classGrade: u.classGrade ?? '',
        section: u.section ?? '',
        rollNo: u.rollNo ?? '',
        roles: u.roles.map((r: any) => r.name).join(', '),
        status: u.status ? 'Active' : 'Inactive',
        createdAt: u.createdAt.toISOString().slice(0, 10),
      });
      row.height = 20;
      row.eachCell((cell: any) => {
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.border = this.thinBorder();
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: i % 2 === 0 ? 'FFF7F9FC' : 'FFFFFFFF' },
        };
      });
    });

    ws.autoFilter = { from: 'A1', to: `J1` };

    return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async importUsersFromXlsx(
    fileBuffer: Buffer | ArrayBuffer | Uint8Array,
  ): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    // Normalize various buffer/array types to Node Buffer to satisfy exceljs types
    const normalizedBuffer =
      fileBuffer instanceof Buffer
        ? fileBuffer
        : Buffer.from(fileBuffer as any);
    await wb.xlsx.load(normalizedBuffer as any);

    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('No worksheet found in file');

    const headerRow = ws.getRow(1);
    const colMap: Record<string, number> = {};
    headerRow.eachCell((cell, colNum) => {
      const key = String(cell.value ?? '').trim();
      colMap[key] = colNum;
    });

    const required = [
      'Name',
      'Class',
      'Section',
      'Roll No',
      'Contact No.',
      'Institute Id',
    ];
    for (const col of required) {
      if (!colMap[col])
        throw new BadRequestException(`Missing column: "${col}"`);
    }
    // Validate mobile numbers first to catch duplicates before any DB operations

    const results: {
      name: string;
      classGrade: string;
      section: string;
      rollNo: string;
      mobile: string;
      instituteId: number;
      password: string;
      status: string;
    }[] = [];
    // if duplicate mobile no present then return from here
    const seenMobiles = new Set<string>();

    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);

      const mobile = String(
        row.getCell(colMap['Contact No.']).value ?? '',
      ).trim();

      if (!mobile) continue;

      if (seenMobiles.has(mobile)) {
        throw new ConflictException(
          `Duplicate Contact No. found in file: ${mobile}`,
        );
      }

      seenMobiles.add(mobile);
    }
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const name = String(row.getCell(colMap['Name']).value ?? '').trim();
      if (!name) continue;

      const mobile = String(
        row.getCell(colMap['Contact No.']).value ?? '',
      ).trim();
      const classGrade = String(
        row.getCell(colMap['Class']).value ?? '',
      ).trim();
      const section = String(row.getCell(colMap['Section']).value ?? '').trim();
      const rollNo = String(row.getCell(colMap['Roll No']).value ?? '').trim();
      const instituteId = Number(
        row.getCell(colMap['Institute Id']).value ?? 0,
      );

      const firstName = name.split(/\s+/)[0];
      const rawPassword = `${firstName}@123`;
      const hashedPassword = await bcrypt.hash(rawPassword, 10);

      let status = 'Created';
      try {
        // Upsert by mobile (unique key for students)
        await this.prisma.user.upsert({
          where: { mobile },
          update: {
            name,
            classGrade,
            userType: 'STUDENT',
            section,
            rollNo,
            password: hashedPassword,
          },
          create: {
            name,
            classGrade,
            userType: 'STUDENT',
            section,
            rollNo,
            mobile,
            mobile_prefix: '+91',
            password: hashedPassword,
            institutionMembers: {
              create: { institutionId: instituteId },
            },
          },
        });
      } catch (e: any) {
        status = `Error: ${e?.message?.slice(0, 60) ?? 'unknown'}`;
      }

      results.push({
        name,
        classGrade,
        section,
        rollNo,
        mobile,
        instituteId,
        password: rawPassword,
        status,
      });
    }
    const out = new ExcelJS.Workbook();
    const ows = out.addWorksheet('Import Result');

    ows.columns = [
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Class', key: 'classGrade', width: 10 },
      { header: 'Section', key: 'section', width: 10 },
      { header: 'Roll No', key: 'rollNo', width: 10 },
      { header: 'Contact No.', key: 'mobile', width: 16 },
      { header: 'Institute Id', key: 'instituteId', width: 14 },
      { header: 'Password', key: 'password', width: 20 },
      { header: 'Status', key: 'status', width: 30 },
    ];

    const hdr = ows.getRow(1);
    hdr.height = 28;
    hdr.eachCell((cell) => {
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
        name: 'Arial',
        size: 11,
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A5F' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = this.thinBorder();
    });

    results.forEach((rec, i) => {
      const row = ows.addRow(rec);
      row.height = 22;
      const isError = rec.status !== 'Created';
      row.eachCell((cell, col) => {
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = this.thinBorder();
        if (col === 7) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF3CD' },
          };
          cell.font = {
            name: 'Arial',
            size: 10,
            bold: true,
            color: { argb: 'FF856404' },
          };
        } else if (isError) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFDE8E8' },
          };
        } else {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: i % 2 === 0 ? 'FFF0F4FA' : 'FFFFFFFF' },
          };
        }
      });
      // Status column green/red
      const statusCell = row.getCell(8);
      if (!isError) {
        statusCell.font = {
          name: 'Arial',
          size: 10,
          bold: true,
          color: { argb: 'FF155724' },
        };
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD4EDDA' },
        };
      }
    });

    return (await out.xlsx.writeBuffer()) as unknown as Buffer;
  }

  private thinBorder(): Partial<ExcelJS.Borders> {
    const s: Partial<ExcelJS.Border> = {
      style: 'thin',
      color: { argb: 'FFCCCCCC' },
    };
    return { left: s, right: s, top: s, bottom: s };
  }

  async submissionCertificates(userId: number, paginationDto: PaginationDto) {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;
    const [certificates, total] = await Promise.all([
      this.prisma.userCompletionCertificate.findMany({
        where: { userId },
        include: {
          course: true,
          quizAttempt: true,
          quiz: true,
        },

        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),

      this.prisma.userCompletionCertificate.count({
        where: { userId },
      }),
    ]);

    return { certificates, total, page, limit };
  }
}
