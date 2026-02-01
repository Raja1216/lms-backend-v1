import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Course, User } from 'src/generated/prisma/browser';
import { PaginationDto } from 'src/shared/dto/pagination-dto';
interface Badge {
  id: string;
  name: string;
  description: string;
  earnedAt: Date;
}
@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(
    email: string,
    password: string,
    level?: string,
    name?: string,
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
    return this.prisma.user.findUnique({
      where: { email },
      select: {
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
}
