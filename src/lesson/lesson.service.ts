import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Base64FileUtil } from 'src/utils/base64-file.util';
import path from 'path/win32';
import { generateSlug } from 'src/shared/generate-slug';
import { User } from 'src/generated/prisma/browser';
import { generateUniqueCourseSlug } from 'src/shared/generate-unique-slug';

@Injectable()
export class LessonService {
  constructor(private prisma: PrismaService) {}

  async create(createLessonDto: CreateLessonDto) {
    const {
      title,
      description,
      lessonType,
      chapterIds,
      documentContent,
      videoUrl,
      topicName,
      NumberOfPages,
      noOfXpPoints,
    } = createLessonDto;
    let documentUrl: string | null = null;
    if (documentContent) {
      if (documentContent.startsWith('data:')) {
        const savedFile = await Base64FileUtil.saveBase64File(
          documentContent,
          'uploads/lessons/documents',
        );
        const relativePath = path.posix.join(
          'uploads/lessons/documents',
          savedFile.fileName,
        );
        documentUrl = process.env.APP_URL + '/' + relativePath;
      } else {
          documentUrl = documentContent;
        }
    }
    const lesson = await this.prisma.lesson.create({
      data: {
        title,
        description,
        slug: await generateUniqueCourseSlug(this.prisma, title),
        topicName,
        docUrl: documentUrl,
        videoUrl,
        type: lessonType,
        NoOfPages: NumberOfPages,
        noOfXpPoints: noOfXpPoints,
      },
    });
    const lessonToChapter: any[] = [];
    for (const chapterId of chapterIds) {
      await this.prisma.lessonToChapter.create({
        data: {
          lessonId: lesson.id,
          chapterId: chapterId,
        },
      });
      lessonToChapter.push({ lessonId: lesson.id, chapterId: chapterId });
    }
    return { ...lesson, chapters: lessonToChapter };
  }

  async findAll() {
    return this.prisma.lesson.findMany({
      where: { status: true },
      orderBy: { createdAt: 'desc' },
      include: {
        chapters: {
          include: {
            chapter: true,
          },
        },
      },
    });
  }


  findOne(id: number) {
    return this.prisma.lesson.findUnique({
      where: { id },
      include: {
        chapters: {
          include: {
            chapter: true,
          },
        },
      },
    });
  }

  async update(id: number, updateLessonDto: UpdateLessonDto) {
    const existingLesson = await this.findOne(id);
    if (!existingLesson) {
      throw new NotFoundException('Lesson not found');
    }
    const {
      title,
      description,
      lessonType,
      documentContent,
      videoUrl,
      topicName,
      chapterIds,
      NumberOfPages,
      noOfXpPoints,
    } = updateLessonDto;
    let documentUrl: string | null = null;
    if (documentContent) {
      if (documentContent.startsWith('data:')) {
        const savedFile = await Base64FileUtil.saveBase64File(
          documentContent,
          'uploads/lessons/documents',
        );
        const relativePath = path.posix.join(
          'uploads/lessons/documents',
          savedFile.fileName,
        );
        documentUrl = process.env.APP_URL + '/' + relativePath;
    } else {
      documentUrl = documentContent;
    }
    }
    const updatedLesson = await this.prisma.lesson.update({
      where: { id },
      data: {
        title,
        description,
        slug: title ? await generateUniqueCourseSlug(this.prisma, title, id) : undefined,
        topicName,
        docUrl: documentUrl,
        videoUrl,
        type: lessonType,
        NoOfPages: NumberOfPages,
        noOfXpPoints: noOfXpPoints,
      },
    });
    const lessonToChapter: any[] = [];
    if (chapterIds && chapterIds.length > 0) {
      await this.prisma.lessonToChapter.deleteMany({
        where: { lessonId: id },
      });
      for (const chapterId of chapterIds) {
        await this.prisma.lessonToChapter.create({
          data: {
            lessonId: updatedLesson.id,
            chapterId: chapterId,
          },
        });
        lessonToChapter.push({
          lessonId: updatedLesson.id,
          chapterId: chapterId,
        });
      }
    }
    return { ...updatedLesson, chapters: lessonToChapter };
  }

  async remove(id: number) {
    const lesson = await this.findOne(id);
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    return this.prisma.lesson.update({
      where: { id },
      data: { status: false },
    });
  }


  async updateStatus(id: number) {
    const lesson = await this.findOne(id);
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    const updatedLesson = await this.prisma.lesson.update({
      where: { id },
      data: { status: !lesson.status },
    });
    return updatedLesson;
  }

  async findLessonByTitle(title: string, id?: number): Promise<Boolean> {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        title: title,
        ...(id && { id: { not: id } }),
      },
    });
    return Boolean(lesson);
  }
  async findBySlug(slug: string): Promise<any> {
    const lesson = await this.prisma.lesson.findUnique({
      where: {
        slug: slug,
      },
      include: {
        quizzes: {
          select: {
            quiz: true,
          },
        },
      },
    });
    return lesson;
  }
  async completeLesson(lessonId: number, user: User): Promise<any> {
    // Check if user is enrolled in the course containing the lesson
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        chapters: {
          some: {
            chapter: {
              subjects: {
                some: {
                  subject: {
                    courses: {
                      some: {
                        course: {
                          userEnrolledCourses: {
                            some: {
                              userId: user.id,
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
      select: {
        id: true,
        noOfXpPoints: true,
      },
    });

    if (!lesson) {
      throw new BadRequestException(
        'Invalid lesson or user not enrolled in the course containing the lesson',
      );
    }

    // Check if lesson already completed
    const alreadyCompleted = await this.prisma.userXPEarned.findFirst({
      where: {
        userId: user.id,
        lessonId,
      },
    });

    if (alreadyCompleted) {
      throw new BadRequestException('Lesson already completed');
    }

    //  Mark lesson as completed
    await this.prisma.userXPEarned.create({
      data: {
        userId: user.id,
        lessonId,
      },
    });

    //  Get lesson quizzes
    const lessonQuizzes = await this.prisma.quiz.findMany({
      where: {
        lessons: {
          some: {
            lessonId,
          },
        },
      },
      select: { id: true },
    });

    const lessonQuizIds = lessonQuizzes.map((q) => q.id);

    //  Check if XP already earned via quizzes
    const xpFromQuizzes = await this.prisma.userXPEarned.findFirst({
      where: {
        userId: user.id,
        quizId: {
          in: lessonQuizIds,
        },
      },
    });

    //  Calculate XP to add
    const xpToAdd = xpFromQuizzes ? 0 : (lesson.noOfXpPoints ?? 0);

    //  Update user XP
    if (xpToAdd > 0) {
      await this.prisma.userXPEarned.create({
        data: {
          userId: user.id,
          lessonId: lesson.id,
          xpPoints: xpToAdd,
        },
      });
    }

    //  Return response
    return {
      message:
        xpToAdd > 0
          ? 'Lesson completed and XP awarded'
          : 'Lesson completed (XP already earned via quiz)',
    };
  }
}
