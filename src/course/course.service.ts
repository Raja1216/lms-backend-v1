import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Base64FileUtil } from 'src/utils/base64-file.util';
import dotenv from 'dotenv';
import path from 'path/win32';
import { PaginationDto } from 'src/shared/dto/pagination-dto';
import { User } from 'src/generated/prisma/browser';
import { generateUniqueCourseSlug } from 'src/shared/generate-unique-slug';
import { CreateFullCourseDto } from './dto/create-full-course.dto';
import { LessonType } from 'src/generated/prisma/enums';
import { Prisma } from 'src/generated/prisma/client';
import { generateUniqueSlugForTable } from 'src/shared/generate-unique-slug-for-table';
import { QuizService } from 'src/quiz/quiz.service';
import { UploadService } from 'src/upload/upload.service';

import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { CategoryService } from 'src/category/category.service';
import { CourseQueryDto } from './dto/course-query.dto';

dotenv.config();

@Injectable()
export class CourseService {
  constructor(
    private prisma: PrismaService,
    private quizService: QuizService,
    private readonly uploaService: UploadService,
    private readonly activityLogService: ActivityLogService,
    private readonly categoryService: CategoryService,
  ) {}

  async create(createCourseDto: CreateCourseDto, user?: User) {
    const {
      title,
      description,
      thumbnail,
      grade,
      audience,
      duration,
      price,
      discountedPrice,
      teacherIds,
      categoryIds = [],
    } = createCourseDto;

    let institutionId: number | null = null;
    if (user?.id) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: {
          ownedInstitutions: {
            where: { status: true },
            select: { id: true },
            take: 1,
          },
          institutionMembers: {
            where: { status: true },
            select: { institutionId: true },
            take: 1,
          },
        },
      });

      institutionId =
        dbUser?.ownedInstitutions?.[0]?.id ||
        dbUser?.institutionMembers?.[0]?.institutionId ||
        null;
    }

    let thumbnailPath = thumbnail;

    if (thumbnail?.startsWith('data:')) {
      const matches = thumbnail.match(/^data:(.+);base64,(.+)$/);

      if (!matches) {
        throw new BadRequestException('Invalid base64 thumbnail');
      }

      const mimeType = matches[1];
      const base64Data = matches[2];

      const extension = mimeType.split('/')[1]; // image/png → png
      const buffer = Buffer.from(base64Data, 'base64');

      const uploaded = await this.uploaService.uploadBufferViaFtp(
        buffer,
        `thumbnail.${extension}`,
        'image',
      );

      thumbnailPath = uploaded.url;
    }

    const slug = await generateUniqueSlugForTable(this.prisma, 'course', title);

    const validCategoryIds =
      await this.categoryService.validateCategoryIds(categoryIds);

    const course = await this.prisma.course.create({
      data: {
        title,
        description,
        thumbnail: thumbnailPath ?? '',
        grade,
        audience,
        duration,
        price,
        discountedPrice,
        slug,
        create_institution_id: institutionId,
        categories: validCategoryIds.length

          ? {
              create: validCategoryIds.map((categoryId) => ({
                category: {
                  connect: {
                    id: categoryId,
                  },
                },
              })),
            }
          : undefined,
      },

      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    const teachers = await Promise.all(
      teacherIds.map((teacherId) =>
        this.prisma.courseTeacher.create({
          data: { courseId: course.id, teacherId },
        }),
      ),
    );

    return { ...course, teachers };
  }

  async findAll(userId: number, paginationDto: CourseQueryDto) {
    const {
      page = 1,
      limit = 10,
      grade = null,
      keyword = null,
      categoryId,
    } = paginationDto;

    const skip = (page - 1) * limit;

    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        classGrade: true,
        userType: true,
        roles: {
          select: {
            name: true,
          },
        },
        institutionMembers: {
          where: {
            status: true,
          },
          select: {
            institutionId: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isAdmin = user.roles.some(
      (role) => role.name.toLowerCase() === 'super admin',
    );

    const isTeacher = user.roles.some(
      (role) => role.name.toLowerCase() === 'teacher',
    );

    let enrolledCourseIds: number[] = [];

    const enrollments = await this.prisma.userEnrolledCourse.findMany({
      where: {
        userId,
      },
      select: {
        courseId: true,
      },
    });

    enrolledCourseIds = enrollments.map((e) => e.courseId);

    const institutionIds = user.institutionMembers.map(
      (member) => member.institutionId,
    );

    // Student enrolled courses
    const userType = user.userType || 'STUDENT';

    const whereClause: any = {
      status: true,
      AND: [],
    };

    if (categoryId) {
      whereClause.AND.push({
        categories: {
          some: {
            categoryId,
          },
        },
      });
    }

    if (!isAdmin) {
      if (isTeacher) {
        whereClause.AND.push({
          OR: [
            // All courses purchased/assigned to the teacher's institution
            {
              institutionCourses: {
                some: {
                  institutionId: {
                    in: institutionIds,
                  },
                },
              },
            },

            // All courses where the teacher is personally enrolled
            {
              id: {
                in: enrolledCourseIds,
              },
            },
          ],
        });
      } else if (userType === 'STUDENT') {
        whereClause.AND.push({
          OR: [
            // 1. School courses matching student's grade
            {
              audience: 'SCHOOL',
              grade: user.classGrade,
            },

            // 2. Courses assigned/purchased by student's institution
            //    AND course grade matches student OR grade is null
            {
              AND: [
                {
                  institutionCourses: {
                    some: {
                      institutionId: {
                        in: institutionIds,
                      },
                    },
                  },
                },
                {
                  OR: [
                    {
                      grade: user.classGrade,
                    },
                    {
                      grade: null,
                    },
                  ],
                },
              ],
            },

            // 3. All public courses
            {
              audience: 'PUBLIC',
            },

            // 4. Courses where student has UserEnrolledCourse
            {
              id: {
                in: enrolledCourseIds,
              },
            },
          ],
        });
      } else if (userType === 'PROFESSIONAL') {
        whereClause.AND.push({
          OR: [
            {
              audience: 'PROFESSIONAL',
            },
            {
              audience: 'PUBLIC',
            },
            {
              id: {
                in: enrolledCourseIds,
              },
            },
          ],
        });
      } else if (userType === 'TEACHER') {
        // Fallback when userType is TEACHER but teacher role is missing
        whereClause.AND.push({
          OR: [
            {
              audience: 'TEACHER',
            },
            {
              audience: 'PUBLIC',
            },
            {
              id: {
                in: enrolledCourseIds,
              },
            },
          ],
        });
      }
    }
    // Keyword Search
    if (keyword) {
      whereClause.AND.push({
        OR: [
          {
            title: {
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
        ],
      });
    }

    // Admin / Teacher
    if (isAdmin || isTeacher) {
      if (grade) {
        whereClause.AND.push({
          grade,
        });
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.course.findMany({
        where: whereClause,

        skip,
        take: limit,

        orderBy: {
          createdAt: 'desc',
        },

        include: {
          teachers: {
            include: {
              teacher: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },

          categories: {
            where: {
              category: {
                status: true,
              },
            },

            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  image: true,
                  parentId: true,
                },
              },
            },
          },

          _count: {
            select: {
              subjects: true,
            },
          },
        },
      }),

      this.prisma.course.count({
        where: whereClause,
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const course = await this.prisma.course.findFirst({
      where: {
        id,
        status: true,
      },

      include: {
        teachers: {
          include: {
            teacher: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },

        categories: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                image: true,
                parentId: true,
              },
            },
          },
        },

        subjects: {
          where: {
            subject: {
              status: true,
            },
          },

          include: {
            subject: {
              include: {
                modules: {
                  where: {
                    status: true,
                  },

                  include: {
                    chapters: {
                      where: {
                        chapter: {
                          status: true,
                        },
                      },

                      include: {
                        chapter: {
                          include: {
                            lessons: {
                              where: {
                                lesson: {
                                  status: true,
                                },
                              },

                              include: {
                                lesson: true,
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
        },
      },
    });

    if (!course) {
      throw new BadRequestException('Course not found');
    }

    // fetch all live classes once
    const liveClasses = await this.prisma.live_classes.findMany({
      where: {
        courseId: course.id,
      },

      include: {
        host: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },

        recordings: true,

        subject: {
          select: {
            id: true,
            name: true,
          },
        },

        chapter: {
          select: {
            id: true,
            title: true,
          },
        },

        module: {
          select: {
            id: true,
            title: true,
          },
        },
      },

      orderBy: {
        scheduledAt: 'asc',
      },
    });

    // course level classes
    const courseLevelClasses = liveClasses.filter(
      (cls) => !cls.subjectId && !cls.moduleId && !cls.chapterId,
    );

    const subjects = course.subjects
      .filter((courseSubject) => courseSubject.subject?.status)
      .map((courseSubject) => {
        const subject = courseSubject.subject;

        // subject level classes
        const subjectClasses = liveClasses.filter(
          (cls) =>
            cls.subjectId === subject.id && !cls.moduleId && !cls.chapterId,
        );

        const modules = subject.modules
          .filter((module) => module.status)
          .map((module) => {
            // module level classes
            const moduleClasses = liveClasses.filter(
              (cls) => cls.moduleId === module.id && !cls.chapterId,
            );

            const chapters = module.chapters
              .filter((moduleChapter) => moduleChapter.chapter?.status)
              .map((moduleChapter) => {
                const chapter = moduleChapter.chapter;

                // chapter level classes
                const chapterClasses = liveClasses.filter(
                  (cls) => cls.chapterId === chapter.id,
                );

                return {
                  ...chapter,
                  liveClasses: chapterClasses,
                };
              });

            return {
              ...module,
              liveClasses: moduleClasses,
              chapters,
            };
          });

        return {
          ...subject,
          liveClasses: subjectClasses,
          modules,
        };
      });

    return {
      ...course,
      liveClasses: courseLevelClasses,
      subjects,
    };
  }

  async findCourseBySlug(slug: string, user: User) {
    const course = await this.prisma.course.findFirst({
      where: {
        slug,
        status: true,
      },

      include: {
        teachers: {
          include: {
            teacher: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },

        categories: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                image: true,
                parentId: true,
              },
            },
          },
        },

        subjects: {
          where: {
            subject: {
              status: true,
            },
          },

          include: {
            subject: {
              include: {
                modules: {
                  where: {
                    status: true,
                  },

                  include: {
                    chapters: {
                      where: {
                        chapter: {
                          status: true,
                        },
                      },

                      include: {
                        chapter: {
                          include: {
                            lessons: {
                              where: {
                                lesson: {
                                  status: true,
                                },
                              },

                              include: {
                                lesson: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                chapters: {
                  where: {
                    chapter: {
                      status: true,
                    },
                  },
                  include: {
                    chapter: {
                      include: {
                        lessons: {
                          where: {
                            lesson: {
                              status: true,
                            },
                          },
                          include: {
                            lesson: true,
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

    if (!course) {
      throw new BadRequestException('Course not found');
    }

    const enrolled = await this.prisma.userEnrolledCourse.findFirst({
      where: {
        userId: user.id,
        courseId: course.id,
      },
      select: {
        courseId: true,
      },
    });

    const institutionMembers = await this.prisma.institutionMember.findMany({
      where: {
        userId: user.id,
        status: true,
      },
      select: {
        institutionId: true,
      },
    });

    const institutionCourseAssignments = institutionMembers.length
      ? await this.prisma.institutionCourse.findMany({
          where: {
            institutionId: {
              in: institutionMembers.map((member) => member.institutionId),
            },
            courseId: course.id,
          },
          select: {
            courseId: true,
          },
        })
      : [];

    const isEnrolled = !!enrolled || institutionCourseAssignments.length > 0;

    const liveClasses = await this.prisma.live_classes.findMany({
      where: {
        courseId: course.id,
      },

      include: {
        host: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },

        recordings: true,

        subject: {
          select: {
            id: true,
            name: true,
          },
        },

        chapter: {
          select: {
            id: true,
            title: true,
          },
        },

        module: {
          select: {
            id: true,
            title: true,
          },
        },
      },

      orderBy: {
        scheduledAt: 'asc',
      },
    });

    const courseLevelClasses = liveClasses.filter(
      (cls) => !cls.subjectId && !cls.moduleId && !cls.chapterId,
    );

    const subjects = course.subjects
      .filter((courseSubject) => courseSubject.subject?.status)
      .map((courseSubject) => {
        const subject = courseSubject.subject;

        const subjectClasses = liveClasses.filter(
          (cls) =>
            cls.subjectId === subject.id && !cls.moduleId && !cls.chapterId,
        );

        const modules = subject.modules
          .filter((module) => module.status)
          .map((module) => {
            const moduleClasses = liveClasses.filter(
              (cls) => cls.moduleId === module.id && !cls.chapterId,
            );

            const chapters = module.chapters
              .filter((moduleChapter) => moduleChapter.chapter?.status)
              .map((moduleChapter) => {
                const chapter = moduleChapter.chapter;

                const chapterClasses = liveClasses.filter(
                  (cls) => cls.chapterId === chapter.id,
                );

                return {
                  ...chapter,
                  liveClasses: chapterClasses,
                };
              });

            return {
              ...module,
              liveClasses: moduleClasses,
              chapters,
            };
          });

        const directChapters = (subject.chapters ?? [])
          .filter((subjectChapter) => subjectChapter.chapter?.status)
          .map((subjectChapter) => {
            const chapter = subjectChapter.chapter;
            const chapterClasses = liveClasses.filter(
              (cls) => cls.chapterId === chapter.id,
            );
            return {
              ...chapter,
              liveClasses: chapterClasses,
            };
          });

        return {
          ...subject,
          liveClasses: subjectClasses,
          modules,
          chapters: directChapters,
        };
      });

    // Find the first lesson ID in the course safely from active subjects/modules/chapters
    let firstLessonId: number | undefined;
    for (const sub of subjects) {
      if (sub.modules) {
        for (const mod of sub.modules) {
          if (mod.chapters) {
            for (const chap of mod.chapters) {
              if (chap.lessons) {
                for (const les of chap.lessons) {
                  if (les.lesson?.id) {
                    firstLessonId = les.lesson.id;
                    break;
                  }
                }
              }
              if (firstLessonId) break;
            }
          }
          if (firstLessonId) break;
        }
      }
      if (firstLessonId) break;

      if (sub.chapters) {
        for (const chap of sub.chapters) {
          if (chap.lessons) {
            for (const les of chap.lessons) {
              if (les.lesson?.id) {
                firstLessonId = les.lesson.id;
                break;
              }
            }
          }
          if (firstLessonId) break;
        }
      }
      if (firstLessonId) break;
    }

    try {
      await this.activityLogService.logActivity(
        user.id,
        'Course Viewed',
        course.id,
      );
    } catch (err) {
      console.error('Failed to log Course Viewed activity', err);
    }

    if (firstLessonId) {
      try {
        await this.activityLogService.logActivity(
          user.id,
          'Lesson Viewed',
          course.id,
          {
            lessonId: firstLessonId,
          },
        );
      } catch (err) {
        console.error(
          'Failed to log Lesson Viewed activity on course details page load',
          err,
        );
      }
    }

    return {
      ...course,
      isEnrolled,
      liveClasses: courseLevelClasses,
      subjects,
    };
  }

  async getCourseProgress(identifier: string, user: User) {
    const isNumericId = !isNaN(Number(identifier));
    const course = await this.prisma.course.findFirst({
      where: {
        OR: [
          { slug: identifier },
          ...(isNumericId ? [{ id: Number(identifier) }] : []),
        ],
        status: true,
      },
      include: {
        courseQuizzes: {
          where: { quiz: { status: true } },
          select: { quizId: true },
        },
        subjects: {
          where: { subject: { status: true } },
          include: {
            subject: {
              include: {
                subjectQuizzes: {
                  where: { quiz: { status: true } },
                  select: { quizId: true },
                },
                modules: {
                  where: { status: true },
                  include: {
                    moduleQuizzes: {
                      where: { quiz: { status: true } },
                      select: { quizId: true },
                    },
                    chapters: {
                      where: { chapter: { status: true } },
                      include: {
                        chapter: {
                          include: {
                            chapterQuizzes: {
                              where: { quiz: { status: true } },
                              select: { quizId: true },
                            },
                            lessons: {
                              where: { lesson: { status: true } },
                              include: {
                                lesson: {
                                  include: {
                                    quizzes: {
                                      where: { quiz: { status: true } },
                                      select: { quizId: true },
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
                chapters: {
                  where: { chapter: { status: true } },
                  include: {
                    chapter: {
                      include: {
                        chapterQuizzes: {
                          where: { quiz: { status: true } },
                          select: { quizId: true },
                        },
                        lessons: {
                          where: { lesson: { status: true } },
                          include: {
                            lesson: {
                              include: {
                                quizzes: {
                                  where: { quiz: { status: true } },
                                  select: { quizId: true },
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
          },
        },
      },
    });

    if (!course) {
      throw new BadRequestException('Course not found');
    }

    // Check enrollment
    const enrolled = await this.prisma.userEnrolledCourse.findFirst({
      where: {
        userId: user.id,
        courseId: course.id,
      },
      select: { courseId: true },
    });

    const institutionMembers = await this.prisma.institutionMember.findMany({
      where: { userId: user.id, status: true },
      select: { institutionId: true },
    });

    const institutionCourseAssignments = institutionMembers.length
      ? await this.prisma.institutionCourse.findMany({
          where: {
            institutionId: {
              in: institutionMembers.map((m) => m.institutionId),
            },
            courseId: course.id,
          },
          select: { courseId: true },
        })
      : [];

    const isEnrolled = !!enrolled || institutionCourseAssignments.length > 0;

    // Collect all lessonIds and quizIds
    const allLessonIds = new Set<number>();
    const allQuizIds = new Set<number>();

    // Direct course quizzes
    course.courseQuizzes?.forEach((cq) => allQuizIds.add(cq.quizId));

    const subjectsProgress: any[] = [];

    for (const cs of course.subjects ?? []) {
      const subject = cs.subject;
      if (!subject) continue;

      const subjectLessonIds = new Set<number>();
      const subjectQuizIds = new Set<number>();

      subject.subjectQuizzes?.forEach((sq) => {
        allQuizIds.add(sq.quizId);
        subjectQuizIds.add(sq.quizId);
      });

      // Modules
      for (const mod of subject.modules ?? []) {
        mod.moduleQuizzes?.forEach((mq) => {
          allQuizIds.add(mq.quizId);
          subjectQuizIds.add(mq.quizId);
        });

        for (const mc of mod.chapters ?? []) {
          const ch = mc.chapter;
          if (!ch) continue;
          ch.chapterQuizzes?.forEach((cq) => {
            allQuizIds.add(cq.quizId);
            subjectQuizIds.add(cq.quizId);
          });
          for (const ltc of ch.lessons ?? []) {
            if (ltc.lesson) {
              allLessonIds.add(ltc.lesson.id);
              subjectLessonIds.add(ltc.lesson.id);
              ltc.lesson.quizzes?.forEach((lq) => {
                allQuizIds.add(lq.quizId);
                subjectQuizIds.add(lq.quizId);
              });
            }
          }
        }
      }

      // Direct Chapters
      for (const sc of subject.chapters ?? []) {
        const ch = sc.chapter;
        if (!ch) continue;
        ch.chapterQuizzes?.forEach((cq) => {
          allQuizIds.add(cq.quizId);
          subjectQuizIds.add(cq.quizId);
        });
        for (const ltc of ch.lessons ?? []) {
          if (ltc.lesson) {
            allLessonIds.add(ltc.lesson.id);
            subjectLessonIds.add(ltc.lesson.id);
            ltc.lesson.quizzes?.forEach((lq) => {
              allQuizIds.add(lq.quizId);
              subjectQuizIds.add(lq.quizId);
            });
          }
        }
      }

      subjectsProgress.push({
        id: subject.id,
        name: subject.name,
        slug: subject.slug,
        lessonIds: [...subjectLessonIds],
        quizIds: [...subjectQuizIds],
      });
    }

    const lessonIdsArray = [...allLessonIds];
    const quizIdsArray = [...allQuizIds];

    // Completed Lessons for user
    const completedXp = lessonIdsArray.length
      ? await this.prisma.userXPEarned.findMany({
          where: {
            userId: user.id,
            lessonId: { in: lessonIdsArray },
          },
          select: { lessonId: true },
          distinct: ['lessonId'],
        })
      : [];

    const completedLessonIds = [
      ...new Set(
        completedXp
          .map((x) => x.lessonId)
          .filter((id): id is number => id !== null),
      ),
    ];

    // Attempted Quizzes for user
    const quizAttempts = quizIdsArray.length
      ? await this.prisma.quizAttempt.findMany({
          where: {
            userId: user.id,
            quizId: { in: quizIdsArray },
          },
          select: { quizId: true },
          distinct: ['quizId'],
        })
      : [];

    const completedQuizIds = [
      ...new Set(quizAttempts.map((q) => q.quizId)),
    ];

    // Certificate issued
    const certificate = await this.prisma.userCompletionCertificate.findFirst({
      where: { userId: user.id, courseId: course.id },
      select: { id: true, certificateNumber: true, createdAt: true, fileUrl: true },
    });

    const totalLessons = lessonIdsArray.length;
    const completedLessons = completedLessonIds.length;
    const totalQuizzes = quizIdsArray.length;
    const completedQuizzes = completedQuizIds.length;

    const totalItems = totalLessons + totalQuizzes;
    const completedItems = completedLessons + completedQuizzes;

    const progressPercentage =
      totalItems > 0
        ? Math.round((completedItems / totalItems) * 100)
        : totalLessons > 0
          ? Math.round((completedLessons / totalLessons) * 100)
          : 0;

    const isCompleted =
      totalItems > 0
        ? completedItems >= totalItems
        : totalLessons > 0
          ? completedLessons >= totalLessons
          : false;

    // Map subject breakdown
    const enrichedSubjectsProgress = subjectsProgress.map((sp) => {
      const sCompletedLessons = sp.lessonIds.filter((lid: number) =>
        completedLessonIds.includes(lid),
      ).length;
      const sCompletedQuizzes = sp.quizIds.filter((qid: number) =>
        completedQuizIds.includes(qid),
      ).length;
      const sTotalItems = sp.lessonIds.length + sp.quizIds.length;
      const sCompletedItems = sCompletedLessons + sCompletedQuizzes;
      const sPercentage =
        sTotalItems > 0
          ? Math.round((sCompletedItems / sTotalItems) * 100)
          : sp.lessonIds.length > 0
            ? Math.round((sCompletedLessons / sp.lessonIds.length) * 100)
            : 0;

      return {
        id: sp.id,
        name: sp.name,
        slug: sp.slug,
        totalLessons: sp.lessonIds.length,
        completedLessons: sCompletedLessons,
        totalQuizzes: sp.quizIds.length,
        completedQuizzes: sCompletedQuizzes,
        progressPercentage: sPercentage,
      };
    });

    return {
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      isEnrolled,
      totalLessons,
      completedLessons,
      totalQuizzes,
      completedQuizzes,
      totalItems,
      completedItems,
      progressPercentage,
      isCompleted,
      certificateIssued: !!certificate,
      certificateDetails: certificate || null,
      completedLessonIds,
      completedQuizIds,
      subjectsProgress: enrichedSubjectsProgress,
    };
  }

  async getBatchCourseProgress(courseIds: number[], user: User) {
    let targetCourseIds = Array.isArray(courseIds) ? [...courseIds] : [];

    // If no course IDs supplied, automatically look up all courses user is enrolled in
    if (!targetCourseIds || targetCourseIds.length === 0) {
      const enrollments = await this.prisma.userEnrolledCourse.findMany({
        where: { userId: user.id },
        select: { courseId: true },
      });

      const institutionMembers = await this.prisma.institutionMember.findMany({
        where: { userId: user.id, status: true },
        select: { institutionId: true },
      });

      const instCourses = institutionMembers.length
        ? await this.prisma.institutionCourse.findMany({
            where: {
              institutionId: {
                in: institutionMembers.map((m) => m.institutionId),
              },
            },
            select: { courseId: true },
          })
        : [];

      const allIds = new Set<number>([
        ...enrollments.map((e) => e.courseId),
        ...instCourses.map((c) => c.courseId),
      ]);
      targetCourseIds = [...allIds];
    }

    const progressList = await Promise.all(
      targetCourseIds.map(async (id) => {
        try {
          return await this.getCourseProgress(String(id), user);
        } catch (err) {
          return null;
        }
      }),
    );

    const validResults = progressList.filter(
      (item): item is NonNullable<typeof item> => item !== null,
    );

    const progressMap: Record<number, any> = {};
    for (const item of validResults) {
      if (item && item.courseId) {
        progressMap[item.courseId] = item;
      }
    }

    return {
      courses: validResults,
      progressMap,
    };
  }

  async update(id: number, updateCourseDto: UpdateCourseDto) {
    const existing = await this.findOne(id);

    let slug = existing.slug;
    if (updateCourseDto.title && updateCourseDto.title !== existing.title) {
      slug = await generateUniqueSlugForTable(
        this.prisma,
        'course',
        updateCourseDto.title,
      );
    }

    const {
      teacherIds,
      categoryIds,
      price,
      discountedPrice,
      thumbnail,
      ...rest
    } = updateCourseDto;
    let thumUrl = thumbnail;
    if (thumbnail?.startsWith('data:')) {
      const matches = thumbnail.match(/^data:(.+);base64,(.+)$/);

      if (!matches) {
        throw new BadRequestException('Invalid base64 thumbnail');
      }

      const mimeType = matches[1];
      const base64Data = matches[2];

      const extension = mimeType.split('/')[1]; // image/png → png
      const buffer = Buffer.from(base64Data, 'base64');

      const uploaded = await this.uploaService.uploadBufferViaFtp(
        buffer,
        `thumbnail.${extension}`,
        'image',
      );

      thumUrl = uploaded.url;
    }

    let validCategoryIds: number[] | undefined;

    if (categoryIds !== undefined) {
      validCategoryIds =
        await this.categoryService.validateCategoryIds(categoryIds);
    }

    const data: Prisma.CourseUpdateInput = {
      ...rest,
      thumbnail: thumUrl ?? existing.thumbnail,
      slug,
      price: price ? new Prisma.Decimal(price) : undefined,
      discountedPrice: discountedPrice
        ? new Prisma.Decimal(discountedPrice)
        : undefined,
    };

    if (teacherIds) {
      data.teachers = {
        deleteMany: {},
        create: teacherIds.map((teacherId) => ({
          teacherId,
        })),
      };
    }

    if (categoryIds !== undefined) {
      data.categories = {
        deleteMany: {},

        create: (validCategoryIds ?? []).map((categoryId) => ({
          category: {
            connect: {
              id: categoryId,
            },
          },
        })),
      };
    }

    return this.prisma.course.update({
      where: { id },
      data,
      include: {
        teachers: true,
        categories: {
          include: {
            category: true,
          },
        },
      },
    });
  }

  async updateStatus(id: number) {
    const course = await this.findOne(id);

    return this.prisma.course.update({
      where: { id },
      data: { status: !course.status },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.course.update({
      where: { id },
      data: { status: false },
    });
  }

  async findCourseByName(name: string, id?: number): Promise<boolean> {
    const course = await this.prisma.course.findFirst({
      where: {
        title: name,
        status: true,
        ...(id && { id: { not: id } }),
      },
    });
    return !!course;
  }

  async enrollInCourse(user: User, courseSlug: string) {
    const course = await this.prisma.course.findFirst({
      where: {
        slug: courseSlug,
        status: true,
      },
    });

    if (!course) {
      throw new BadRequestException('Invalid course');
    }

    const existing = await this.prisma.userEnrolledCourse.findFirst({
      where: {
        userId: user.id,
        courseId: course.id,
      },
    });

    if (existing) {
      throw new BadRequestException('Already enrolled in this course');
    }

    const payment = await this.prisma.payment.create({
      data: {
        userId: user.id,
        courseId: course.id,
        amount: course.discountedPrice,
        status: 'completed',
        currency: 'INR',
      },
    });

    try {
      await this.activityLogService.logActivity(
        user.id,
        'Payment Success',
        course.id,
        {
          paymentId: payment.id,
        },
      );
    } catch (err) {
      console.error('Failed to log Payment Success activity', err);
    }

    try {
      await this.activityLogService.logActivity(
        user.id,
        'Course Enrolled',
        course.id,
      );
    } catch (err) {
      console.error('Failed to log Course Enrolled activity', err);
    }

    return this.prisma.userEnrolledCourse.create({
      data: {
        userId: user.id,
        courseId: course.id,
        paymentId: payment.id,
      },
    });
  }

  async createFullCourse(dto: CreateFullCourseDto, user?: User) {
    let institutionId: number | null = null;
    if (user?.id) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: {
          ownedInstitutions: {
            where: { status: true },
            select: { id: true },
            take: 1,
          },
          institutionMembers: {
            where: { status: true },
            select: { institutionId: true },
            take: 1,
          },
        },
      });

      institutionId =
        dbUser?.ownedInstitutions?.[0]?.id ||
        dbUser?.institutionMembers?.[0]?.institutionId ||
        null;
    }

    return this.prisma.$transaction(async (tx) => {
      // 1️⃣ Course
      const courseSlug = await generateUniqueSlugForTable(
        this.prisma,
        'course',
        dto.title,
      );

      const course = await tx.course.create({
        data: {
          title: dto.title,
          description: dto.description,
          grade: dto.grade,
          duration: dto.duration,
          price: dto.price,
          discountedPrice: dto.discountedPrice,
          thumbnail: dto.thumbnail,
          slug: courseSlug,
          create_institution_id: institutionId,
        },
      });


      if (dto.quiz) {
        await this.quizService.createQuizAndAttach(tx, dto.quiz, {
          courseId: course.id,
        });
      }

      // Teachers
      for (const teacherId of dto.teacherIds) {
        await tx.courseTeacher.create({
          data: { courseId: course.id, teacherId },
        });
      }

      // 2️⃣ Subjects
      for (const subjectDto of dto.subjects) {
        const subjectSlug = await generateUniqueSlugForTable(
          tx as any,
          'subject',
          subjectDto.title,
        );

        const subject = await tx.subject.create({
          data: {
            name: subjectDto.title,
            description: subjectDto.description ?? '',
            slug: subjectSlug,
          },
        });

        if (subjectDto.quiz) {
          await this.quizService.createQuizAndAttach(tx, subjectDto.quiz, {
            subjectId: subject.id,
          });
        }

        await tx.courseSubject.create({
          data: {
            courseId: course.id,
            subjectId: subject.id,
          },
        });

        // 3️⃣ Modules OR direct chapters
        if (subjectDto.hasModules && subjectDto.modules) {
          for (const moduleDto of subjectDto.modules) {
            const moduleSlug = await generateUniqueSlugForTable(
              tx as any,
              'module',
              moduleDto.title,
            );

            const module = await tx.module.create({
              data: {
                title: moduleDto.title,
                slug: moduleSlug,
                subjectId: subject.id,
              },
            });

            if (moduleDto.quiz) {
              await this.quizService.createQuizAndAttach(tx, moduleDto.quiz, {
                moduleId: module.id,
              });
            }

            // 4️⃣ Chapters under module
            for (const chapterDto of moduleDto.chapters ?? []) {
              const chapterSlug = await generateUniqueSlugForTable(
                tx as any,
                'chapter',
                chapterDto.title,
              );

              const chapter = await tx.chapter.create({
                data: {
                  title: chapterDto.title,
                  slug: chapterSlug,
                  description: '',
                },
              });

              if (chapterDto.quiz) {
                await this.quizService.createQuizAndAttach(
                  tx,
                  chapterDto.quiz,
                  { chapterId: chapter.id },
                );
              }

              await tx.subjectChapter.create({
                data: { subjectId: subject.id, chapterId: chapter.id },
              });

              await tx.moduleChapter.create({
                data: { moduleId: module.id, chapterId: chapter.id },
              });

              // 5️⃣ Lessons
              for (const content of chapterDto.contents ?? []) {
                const lessonSlug = await generateUniqueSlugForTable(
                  tx as any,
                  'lesson',
                  content.title,
                );

                const lesson = await tx.lesson.create({
                  data: {
                    title: content.title,
                    topicName: content.title,
                    slug: lessonSlug,
                    type:
                      content.type === 'video'
                        ? LessonType.video
                        : LessonType.document,
                    videoUrl: content.videoUrl,
                    docUrl: content.docUrl,
                    description: content.description ?? '',
                    duration: content.duration,
                    noOfXpPoints: content.noOfXpPoints ?? 0,
                  },
                });

                await tx.lessonToChapter.create({
                  data: {
                    lessonId: lesson.id,
                    chapterId: chapter.id,
                  },
                });

                if (content.quiz) {
                  await this.quizService.createQuizAndAttach(tx, content.quiz, {
                    lessonId: lesson.id,
                  });
                }
              }
            }
          }
        } else if (subjectDto.chapters) {
          // Direct chapters (no modules)
          for (const chapterDto of subjectDto.chapters) {
            const chapterSlug = await generateUniqueSlugForTable(
              tx as any,
              'chapter',
              chapterDto.title,
            );

            const chapter = await tx.chapter.create({
              data: {
                title: chapterDto.title,
                slug: chapterSlug,
                description: '',
              },
            });

            if (chapterDto.quiz) {
              await this.quizService.createQuizAndAttach(tx, chapterDto.quiz, {
                chapterId: chapter.id,
              });
            }

            await tx.subjectChapter.create({
              data: { subjectId: subject.id, chapterId: chapter.id },
            });

            for (const content of chapterDto.contents ?? []) {
              const lessonSlug = await generateUniqueSlugForTable(
                tx as any,
                'lesson',
                content.title,
              );

              const lesson = await tx.lesson.create({
                data: {
                  title: content.title,
                  topicName: content.title,
                  slug: lessonSlug,
                  type:
                    content.type === 'video'
                      ? LessonType.video
                      : LessonType.document,
                  videoUrl: content.videoUrl,
                  docUrl: content.docUrl,
                  description: content.description ?? '',
                  duration: content.duration,
                  noOfXpPoints: content.noOfXpPoints ?? 0,
                },
              });

              await tx.lessonToChapter.create({
                data: {
                  lessonId: lesson.id,
                  chapterId: chapter.id,
                },
              });

              if (content.quiz) {
                await this.quizService.createQuizAndAttach(tx, content.quiz, {
                  lessonId: lesson.id,
                });
              }
            }
          }
        }
      }

      return course;
    });
  }

  async updateFullCourse(courseId: number, dto: CreateFullCourseDto) {
    return this.prisma.$transaction(async (tx) => {
      // 0️⃣ Validate course
      const existingCourse = await tx.course.findUnique({
        where: { id: courseId },
      });

      if (!existingCourse) {
        throw new BadRequestException('Course not found');
      }

      // 1️⃣ Update course core data
      const courseSlug =
        dto.title !== existingCourse.title
          ? await generateUniqueSlugForTable(tx as any, 'course', dto.title)
          : existingCourse.slug;

      const course = await tx.course.update({
        where: { id: courseId },
        data: {
          title: dto.title,
          description: dto.description,
          grade: dto.grade,
          duration: dto.duration,
          price: dto.price,
          discountedPrice: dto.discountedPrice,
          thumbnail: dto.thumbnail,
          slug: courseSlug,
        },
      });

      if (dto.quiz) {
        await this.quizService.createQuizAndAttach(tx, dto.quiz, {
          courseId: course.id,
        });
      }

      // 2️⃣ Get existing subject IDs for this course
      const existingSubjects = await tx.courseSubject.findMany({
        where: { courseId },
        select: { subjectId: true },
      });

      const subjectIds = existingSubjects.map((s) => s.subjectId);

      // 3️⃣ CLEAN OLD TREE (ORDER MATTERS 🔥)

      if (subjectIds.length) {
        // Lesson → Chapter
        await tx.lessonToChapter.deleteMany({
          where: {
            chapter: {
              subjects: {
                some: { subjectId: { in: subjectIds } },
              },
            },
          },
        });

        // Module → Chapter
        await tx.moduleChapter.deleteMany({
          where: {
            module: { subjectId: { in: subjectIds } },
          },
        });

        // Subject → Chapter
        await tx.subjectChapter.deleteMany({
          where: { subjectId: { in: subjectIds } },
        });

        // Lessons
        // await tx.lesson.deleteMany({
        //   where: {
        //     chapters: {
        //       some: {
        //         chapter: {
        //           subjects: {
        //             some: { subjectId: { in: subjectIds } },
        //           },
        //         },
        //       },
        //     },
        //   },
        // });

        // Chapters
        await tx.chapter.deleteMany({
          where: {
            subjects: {
              some: { subjectId: { in: subjectIds } },
            },
          },
        });

        // Modules
        await tx.module.deleteMany({
          where: { subjectId: { in: subjectIds } },
        });

        // Course ↔ Subject
        await tx.courseSubject.deleteMany({
          where: { courseId },
        });

        // Subjects
        await tx.subject.deleteMany({
          where: { id: { in: subjectIds } },
        });

        await tx.courseQuiz.deleteMany({
          where: { courseId },
        });

        await tx.subjectQuiz.deleteMany({
          where: { subjectId: { in: subjectIds } },
        });

        await tx.moduleQuiz.deleteMany({
          where: { module: { subjectId: { in: subjectIds } } },
        });

        await tx.chapterQuiz.deleteMany({
          where: {
            chapter: {
              subjects: {
                some: { subjectId: { in: subjectIds } },
              },
            },
          },
        });

        await tx.lessonQuiz.deleteMany({
          where: {
            lesson: {
              chapters: {
                some: {
                  chapter: {
                    subjects: {
                      some: { subjectId: { in: subjectIds } },
                    },
                  },
                },
              },
            },
          },
        });
      }

      // 4️⃣ Teachers (FULL SYNC)
      await tx.courseTeacher.deleteMany({
        where: { courseId },
      });

      for (const teacherId of dto.teacherIds) {
        await tx.courseTeacher.create({
          data: { courseId, teacherId },
        });
      }

      // 5️⃣ Recreate Subjects → Modules → Chapters → Lessons

      for (const subjectDto of dto.subjects) {
        const subjectSlug = await generateUniqueSlugForTable(
          tx as any,
          'subject',
          subjectDto.title,
        );

        const subject = await tx.subject.create({
          data: {
            name: subjectDto.title,
            description: subjectDto.description ?? '',
            slug: subjectSlug,
          },
        });

        if (subjectDto.quiz) {
          await this.quizService.createQuizAndAttach(tx, subjectDto.quiz, {
            subjectId: subject.id,
          });
        }

        await tx.courseSubject.create({
          data: {
            courseId,
            subjectId: subject.id,
          },
        });

        // Modules flow
        if (subjectDto.hasModules && subjectDto.modules) {
          for (const moduleDto of subjectDto.modules) {
            const moduleSlug = await generateUniqueSlugForTable(
              tx as any,
              'module',
              moduleDto.title,
            );

            const module = await tx.module.create({
              data: {
                title: moduleDto.title,
                slug: moduleSlug,
                subjectId: subject.id,
              },
            });

            if (moduleDto.quiz) {
              await this.quizService.createQuizAndAttach(tx, moduleDto.quiz, {
                moduleId: module.id,
              });
            }

            for (const chapterDto of moduleDto.chapters ?? []) {
              const chapterSlug = await generateUniqueSlugForTable(
                tx as any,
                'chapter',
                chapterDto.title,
              );

              const chapter = await tx.chapter.create({
                data: {
                  title: chapterDto.title,
                  slug: chapterSlug,
                  description: '',
                },
              });

              if (chapterDto.quiz) {
                await this.quizService.createQuizAndAttach(
                  tx,
                  chapterDto.quiz,
                  {
                    chapterId: chapter.id,
                  },
                );
              }

              await tx.subjectChapter.create({
                data: {
                  subjectId: subject.id,
                  chapterId: chapter.id,
                },
              });

              await tx.moduleChapter.create({
                data: {
                  moduleId: module.id,
                  chapterId: chapter.id,
                },
              });

              for (const content of chapterDto.contents ?? []) {
                const lessonSlug = await generateUniqueSlugForTable(
                  tx as any,
                  'lesson',
                  content.title,
                );

                // const lesson = await tx.lesson.create({
                //   data: {
                //     title: content.title,
                //     topicName: content.title,
                //     slug: lessonSlug,
                //     type:
                //       content.type === 'video'
                //         ? LessonType.video
                //         : LessonType.document,
                //     videoUrl: content.videoUrl,
                //     docUrl: content.docUrl,
                //     description: content.description ?? '',
                //     duration: content.duration,
                //     noOfXpPoints: content.noOfXpPoints ?? 0,
                //   },
                // });
                const lesson = await this.findOrCreateLesson(tx, content);

                if (content.quiz) {
                  await this.quizService.createQuizAndAttach(tx, content.quiz, {
                    lessonId: lesson.id,
                  });
                }

                await tx.lessonToChapter.create({
                  data: {
                    lessonId: lesson.id,
                    chapterId: chapter.id,
                  },
                });
              }
            }
          }
        } else if (subjectDto.chapters) {
          // No modules flow
          for (const chapterDto of subjectDto.chapters) {
            const chapterSlug = await generateUniqueSlugForTable(
              tx as any,
              'chapter',
              chapterDto.title,
            );

            const chapter = await tx.chapter.create({
              data: {
                title: chapterDto.title,
                slug: chapterSlug,
                description: '',
              },
            });
            if (chapterDto.quiz) {
              await this.quizService.createQuizAndAttach(tx, chapterDto.quiz, {
                chapterId: chapter.id,
              });
            }

            await tx.subjectChapter.create({
              data: {
                subjectId: subject.id,
                chapterId: chapter.id,
              },
            });

            for (const content of chapterDto.contents ?? []) {
              const lessonSlug = await generateUniqueSlugForTable(
                tx as any,
                'lesson',
                content.title,
              );

              // const lesson = await tx.lesson.create({
              //   data: {
              //     title: content.title,
              //     topicName: content.title,
              //     slug: lessonSlug,
              //     type:
              //       content.type === 'video'
              //         ? LessonType.video
              //         : LessonType.document,
              //     videoUrl: content.videoUrl,
              //     docUrl: content.docUrl,
              //     description: content.description ?? '',
              //     duration: content.duration,
              //     noOfXpPoints: content.noOfXpPoints ?? 0,
              //   },
              // });
              const lesson = await this.findOrCreateLesson(tx, content);

              if (content.quiz) {
                await this.quizService.createQuizAndAttach(tx, content.quiz, {
                  lessonId: lesson.id,
                });
              }

              await tx.lessonToChapter.create({
                data: {
                  lessonId: lesson.id,
                  chapterId: chapter.id,
                },
              });
            }
          }
        }
      }

      return course;
    });
  }

  async getMyEnrolledCourses(userId: number) {
    return this.prisma.userEnrolledCourse.findMany({
      where: {
        userId,
      },

      include: {
        course: {
          include: {
            teachers: {
              include: {
                teacher: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },

            _count: {
              select: {
                subjects: true,
              },
            },
          },
        },

        payment: true,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  private async findOrCreateLesson(tx: any, content: any) {
    let lesson = await tx.lesson.findFirst({
      where: { title: content.title },
    });

    if (!lesson) {
      const slug = await generateUniqueSlugForTable(
        tx,
        'lesson',
        content.title,
      );

      lesson = await tx.lesson.create({
        data: {
          title: content.title,
          topicName: content.title,
          slug,
          type:
            content.type === 'video' ? LessonType.video : LessonType.document,
          videoUrl: content.videoUrl,
          docUrl: content.docUrl,
          description: content.description ?? '',
          duration: content.duration,
          noOfXpPoints: content.noOfXpPoints ?? 0,
        },
      });
    }

    return lesson;
  }
}
