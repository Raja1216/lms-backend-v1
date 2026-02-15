import { Injectable, BadRequestException } from '@nestjs/common';
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

dotenv.config();

@Injectable()
export class CourseService {
  constructor(
    private prisma: PrismaService,
    private quizService: QuizService,
  ) {}

  async create(createCourseDto: CreateCourseDto) {
    const {
      title,
      description,
      thumbnail,
      grade,
      duration,
      price,
      discountedPrice,
      teacherIds,
    } = createCourseDto;

    let thumbnailPath = thumbnail;

    if (thumbnail?.startsWith('data:')) {
      const savedFile = await Base64FileUtil.saveBase64File(
        thumbnail,
        'upload/course-thumbnails',
      );
      const relativePath = path.posix.join(
        'uploads/category-icons',
        savedFile.fileName,
      );
      thumbnailPath = process.env.APP_URL + '/' + relativePath;
    }

    const slug = await generateUniqueSlugForTable(this.prisma, 'course', title);

    const course = await this.prisma.course.create({
      data: {
        title,
        description,
        thumbnail: thumbnailPath ?? '',
        grade,
        duration,
        price,
        discountedPrice,
        slug,
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

  async findAll(paginationDto: PaginationDto) {
    const { page = 1, limit = 10, keyword = null } = paginationDto;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      status: true,
    };

    if (keyword) {
      whereClause.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { slug: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.course.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          teachers: {
            include: {
              teacher: { select: { id: true, name: true, email: true } },
            },
          },
          _count: {
            select: {
              subjects: true, // 👈 SUBJECT COUNT
            },
          },
        },
      }),
      this.prisma.course.count({ where: whereClause }),
    ]);

    return { data, total };
  }

  async findOne(id: number) {
    const course = await this.prisma.course.findFirst({
      where: { id, status: true },
      include: {
        teachers: {
          include: {
            teacher: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!course) {
      throw new BadRequestException('Course not found');
    }

    return course;
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

    const { teacherIds, price, discountedPrice, ...rest } = updateCourseDto;

    const data: Prisma.CourseUpdateInput = {
      ...rest,
      slug,
      price: price ? new Prisma.Decimal(price) : undefined,
      discountedPrice: discountedPrice
        ? new Prisma.Decimal(discountedPrice)
        : undefined,
    };

    // ✅ handle teachers properly
    if (teacherIds) {
      data.teachers = {
        deleteMany: {}, // remove existing teachers
        create: teacherIds.map((teacherId) => ({
          teacherId,
        })),
      };
    }

    return this.prisma.course.update({
      where: { id },
      data,
      include: {
        teachers: true,
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

  async findCourseBySlug(slug: string, user: User) {
    const course = await this.prisma.course.findFirst({
      where: { slug, status: true },
      include: {
        teachers: {
          include: {
            teacher: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!course) {
      throw new BadRequestException('Course not found');
    }

    const enrolled = await this.prisma.userEnrolledCourse.findFirst({
      where: { userId: user.id, courseId: course.id },
    });

    return {
      ...course,
      isEnrolled: !!enrolled,
    };
  }

  // ✅ SOFT DELETE
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

    return this.prisma.userEnrolledCourse.create({
      data: {
        userId: user.id,
        courseId: course.id,
        paymentId: payment.id,
      },
    });
  }

  async createFullCourse(dto: CreateFullCourseDto) {
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
