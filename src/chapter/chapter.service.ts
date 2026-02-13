import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { generateUniqueCourseSlug } from 'src/shared/generate-unique-slug';

@Injectable()
export class ChapterService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateChapterDto) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: dto.subjectId, status: true },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    // Validate module if provided
    if (dto.moduleId) {
      const module = await this.prisma.module.findFirst({
        where: {
          id: dto.moduleId,
          subjectId: dto.subjectId,
          status: true,
        },
      });

      if (!module) {
        throw new BadRequestException(
          'Module does not belong to the given subject',
        );
      }
    }

    const slug = await generateUniqueCourseSlug(this.prisma, dto.title);

    const chapter = await this.prisma.chapter.create({
      data: {
        title: dto.title,
        description: dto.description ?? '',
        slug,
      },
    });

    // Attach to subject (always)
    await this.prisma.subjectChapter.create({
      data: {
        subjectId: dto.subjectId,
        chapterId: chapter.id,
      },
    });

    // Attach to module (optional)
    if (dto.moduleId) {
      await this.prisma.moduleChapter.create({
        data: {
          moduleId: dto.moduleId,
          chapterId: chapter.id,
        },
      });
    }

    return this.findOne(chapter.id);
  }

  async findOne(id: number) {
    const chapter = await this.prisma.chapter.findFirst({
      where: { id, status: true },
      include: {
        subjects: {
          include: {
            subject: true,
          },
        },
        modules: {
          include: {
            module: true,
          },
        },
      },
    });

    if (!chapter) {
      throw new NotFoundException('Chapter not found');
    }

    return chapter;
  }

  async findBySlug(slug: string) {
    const chapter = await this.prisma.chapter.findFirst({
      where: { slug, status: true },
      include: {
        subjects: {
          include: {
            subject: true,
          },
        },
        modules: {
          include: {
            module: true,
          },
        },
      },
    });

    if (!chapter) {
      throw new NotFoundException('Chapter not found');
    }

    return chapter;
  }

  async findBySubject(subjectId: number) {
    return this.prisma.subjectChapter.findMany({
      where: {
        subjectId,
        chapter: { status: true },
      },
      include: {
        chapter: true,
      },
    });
  }

  async findByModule(moduleId: number) {
    return this.prisma.moduleChapter.findMany({
      where: {
        moduleId,
        chapter: { status: true },
      },
      include: {
        chapter: true,
      },
    });
  }

  async update(id: number, dto: UpdateChapterDto) {
    const existing = await this.findOne(id);

    let slug = existing.slug;
    if (dto.title && dto.title !== existing.title) {
      slug = await generateUniqueCourseSlug(this.prisma, dto.title, id);
    }

    await this.prisma.chapter.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        slug,
      },
    });

    return this.findOne(id);
  }

  // ✅ SOFT DELETE
  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.chapter.update({
      where: { id },
      data: { status: false },
    });
  }
}
