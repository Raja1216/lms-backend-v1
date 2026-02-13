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


dotenv.config();

@Injectable()
export class CourseService {
  constructor(private prisma: PrismaService) {}

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

    if (thumbnail.startsWith('data:')) {
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

    const slug = await generateUniqueCourseSlug(this.prisma, title);

    const course = await this.prisma.course.create({
      data: {
        title,
        description,
        thumbnail: thumbnailPath,
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

    if (updateCourseDto.title) {
      slug = await generateUniqueCourseSlug(
        this.prisma,
        updateCourseDto.title,
        id,
      );
    }

    return this.prisma.course.update({
      where: { id },
      data: {
        ...updateCourseDto,
        slug,
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
      const courseSlug = await generateUniqueCourseSlug(tx as any, dto.title);

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

      // Teachers
      for (const teacherId of dto.teacherIds) {
        await tx.courseTeacher.create({
          data: { courseId: course.id, teacherId },
        });
      }

      // 2️⃣ Subjects
      for (const subjectDto of dto.subjects) {
        const subjectSlug = await generateUniqueCourseSlug(tx as any, subjectDto.title);

        const subject = await tx.subject.create({
          data: {
            name: subjectDto.title,
            description: subjectDto.description ?? '',
            slug: subjectSlug,
          },
        });

        await tx.courseSubject.create({
          data: {
            courseId: course.id,
            subjectId: subject.id,
          },
        });

        // 3️⃣ Modules OR direct chapters
        if (subjectDto.hasModules && subjectDto.modules) {
          for (const moduleDto of subjectDto.modules) {
            const moduleSlug = await generateUniqueCourseSlug(tx as any, moduleDto.title);

            const module = await tx.module.create({
              data: {
                title: moduleDto.title,
                slug: moduleSlug,
                subjectId: subject.id,
              },
            });

            // 4️⃣ Chapters under module
            for (const chapterDto of moduleDto.chapters ?? []) {
              const chapterSlug = await generateUniqueCourseSlug(tx as any, chapterDto.title);

              const chapter = await tx.chapter.create({
                data: {
                  title: chapterDto.title,
                  slug: chapterSlug,
                  description: '',
                },
              });

              await tx.subjectChapter.create({
                data: { subjectId: subject.id, chapterId: chapter.id },
              });

              await tx.moduleChapter.create({
                data: { moduleId: module.id, chapterId: chapter.id },
              });

              // 5️⃣ Lessons
              for (const content of chapterDto.contents ?? []) {
                const lessonSlug = await generateUniqueCourseSlug(tx as any, content.title);

                const lesson = await tx.lesson.create({
                  data: {
                    title: content.title,
                    topicName: content.title,
                    slug: lessonSlug,
                    type: content.type === 'video' ? LessonType.video : LessonType.document,
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
              }
            }
          }
        } else if (subjectDto.chapters) {
          // Direct chapters (no modules)
          for (const chapterDto of subjectDto.chapters) {
            const chapterSlug = await generateUniqueCourseSlug(tx as any, chapterDto.title);

            const chapter = await tx.chapter.create({
              data: {
                title: chapterDto.title,
                slug: chapterSlug,
                description: '',
              },
            });

            await tx.subjectChapter.create({
              data: { subjectId: subject.id, chapterId: chapter.id },
            });

            for (const content of chapterDto.contents ?? []) {
              const lessonSlug = await generateUniqueCourseSlug(tx as any, content.title);

              const lesson = await tx.lesson.create({
                data: {
                  title: content.title,
                  topicName: content.title,
                  slug: lessonSlug,
                  type: content.type === 'video' ? LessonType.video : LessonType.document,
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
            }
          }
        }
      }

      return course;
    });
  }

}
