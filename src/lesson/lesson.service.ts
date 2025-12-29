import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Base64FileUtil } from 'src/utils/base64-file.util';
import path from 'path/win32';
import { generateSlug } from 'src/shared/generate-slug';
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
      }
      documentUrl = documentContent;
    }
    const lesson = await this.prisma.lesson.create({
      data: {
        title,
        description,
        slug: generateSlug(title),
        topicName,
        docUrl: documentUrl,
        videoUrl,
        type: lessonType,
        NoOfPages: NumberOfPages,
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

  findAll() {
    return `This action returns all lesson`;
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
    const existingLesson = this.findOne(id);
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
      }
      documentUrl = documentContent;
    }
    const updatedLesson = await this.prisma.lesson.update({
      where: { id },
      data: {
        title,
        description,
        slug: title ? generateSlug(title) : undefined,
        topicName,
        docUrl: documentUrl,
        videoUrl,
        type: lessonType,
        NoOfPages: NumberOfPages,
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

  remove(id: number) {
    return `This action removes a #${id} lesson`;
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
    });
    return lesson;
  }
}
