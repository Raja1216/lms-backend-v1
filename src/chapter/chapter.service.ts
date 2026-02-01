import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { generateSlug } from 'src/shared/generate-slug';
import { User } from 'src/generated/prisma/browser';
@Injectable()
export class ChapterService {
  constructor(private prisma: PrismaService) {}

  async create(createChapterDto: CreateChapterDto) {
    const { title, description, subjectIds } = createChapterDto;
    const chapter = await this.prisma.chapter.create({
      data: {
        title,
        description,
        slug: generateSlug(title),
      },
    });
    const subjectChapter: any[] = [];
    subjectIds.forEach((element) => {
      const chapterSubject = this.prisma.subjectChapter.create({
        data: {
          chapterId: chapter.id,
          subjectId: element,
        },
      });
      subjectChapter.push(chapterSubject);
    });
    return { ...chapter, subjectChapters: await Promise.all(subjectChapter) };
  }

  findAll() {
    return `This action returns all chapter`;
  }

  async findOne(id: number) {
    return await this.prisma.chapter.findUnique({
      where: { id },
      include: {
        lessons: {
          include: {
            lesson: true,
          },
        },
      },
    });
  }

  async findBySlug(slug: string, user: User) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { slug },
      include: {
        lessons: {
          include: {
            lesson: true,
          },
        },
      },
    });
    if (!chapter) {
      return null;
    }
    //add isComplete flag on lessons based on user progress
    const completedLessons = await this.prisma.userXPEarned.findMany({
      where: {
        userId: user.id,
        lessonId: { in: chapter.lessons.map((l) => l.lessonId) },
      },
    });
    const mappedChapters = chapter.lessons.map((lesson) => {
      const isComplete = completedLessons.some(
        (cl) => cl.lessonId === lesson.lessonId,
      );
      return {
        ...lesson,
        isComplete,
      };
    });
    return {
      ...chapter,
      lessons: mappedChapters,
    };
  }

  async update(id: number, updateChapterDto: UpdateChapterDto) {
    const { title, description, subjectIds } = updateChapterDto;
    const existingChapter = await this.findOne(id);
    if (!existingChapter) {
      throw new NotFoundException('Chapter not found');
    }
    const chapter = await this.prisma.chapter.update({
      where: { id },
      data: {
        title,
        description,
        slug: title ? generateSlug(title) : existingChapter.slug,
      },
    });
    const chapterSubject: any[] = [];
    if (subjectIds && subjectIds.length > 0) {
      await this.prisma.subjectChapter.deleteMany({
        where: { chapterId: id },
      });
      subjectIds.forEach((element) => {
        const chapterSubjectCreate = this.prisma.subjectChapter.create({
          data: {
            chapterId: chapter.id,
            subjectId: element,
          },
        });
        chapterSubject.push(chapterSubjectCreate);
      });
    }
    return { ...chapter, subjectChapters: await Promise.all(chapterSubject) };
  }

  async findChapterByTitle(title: string, id?: number): Promise<Boolean> {
    const whereCondition: any = { title };
    if (id) {
      whereCondition.id = { not: id };
    }
    const chapter = await this.prisma.chapter.findFirst({
      where: whereCondition,
    });
    return !!chapter;
  }

  async updateStatus(id: number) {
    const existingChapter = await this.findOne(id);
    if (!existingChapter) {
      throw new NotFoundException('Chapter not found');
    }
    return await this.prisma.chapter.update({
      where: { id },
      data: {
        status: !existingChapter.status,
      },
    });
  }

  remove(id: number) {
    return `This action removes a #${id} chapter`;
  }
}
