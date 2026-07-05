import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { generateUniqueCourseSlug } from 'src/shared/generate-unique-slug';
import { generateUniqueSlugForTable } from 'src/shared/generate-unique-slug-for-table';
import { PaginationDto } from 'src/shared/dto/pagination-dto';

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
    if (dto.subjectId) {
      const existingChapter = await this.prisma.subjectChapter.findFirst({
        where: {
          subjectId: dto.subjectId,
          chapter: {
            title: dto.title,
            status: true,
          },
        },
        include: {
          chapter: true,
        },
      });

      if (existingChapter) {
        throw new BadRequestException(
          'A chapter with the same title already exists for this subject',
        );
      }
    }

    const slug = await generateUniqueSlugForTable(
      this.prisma,
      'chapter',
      dto.title,
    );

    // = await generateUniqueCourseSlug(this.prisma, dto.title);

    const chapter = await this.prisma.chapter.create({
      data: {
        title: dto.title,
        description: dto.description ?? '',
        slug,
        sortOrder: dto.sortOrder,
      },
    });

    if (dto.subjectId) {
      await this.prisma.subjectChapter.create({
        data: {
          subjectId: dto.subjectId,
          chapterId: chapter.id,
        },
      });
    }

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
          where: {
            subject: {
              status: true,
            },
          },
          include: {
            subject: {
              include: {
                courses: true,
              },
            },
          },
        },
        modules: {
          where: {
            module: {
              status: true,
            },
          },
          include: {
            module: true,
          },
        },
      },
    });

    if (!chapter) {
      throw new NotFoundException('Chapter not found');
    }

    return {
      ...chapter,
      subjectId: chapter.subjects[0]?.subjectId ?? null,
      moduleId: chapter.modules[0]?.moduleId ?? null,
      courseId: chapter.subjects[0]?.subject?.courses[0]?.courseId ?? null,
    };
  }

  async findAll(paginationDto: PaginationDto) {
    const { keyword, page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;
    const chapters = await this.prisma.chapter.findMany({
      where: {
        title: {
          contains: keyword,
        },
        status: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
      skip,
      take: limit,

      include: {
        subjects: {
          select: {
            subjectId: true,
            subject: {
              select: {
                courses: {
                  select: {
                    courseId: true,
                  },
                },
              },
            },
          },
        },

        modules: {
          select: {
            moduleId: true,
          },
        },
      },
    });
    const total = await this.prisma.chapter.count({
      where: {
        title: {
          contains: keyword,
        },
        status: true,
      },
    });
    const data = chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      slug: chapter.slug,
      description: chapter.description,
      sortOrder: chapter.sortOrder,

      subjectId: chapter.subjects[0]?.subjectId ?? null,
      moduleId: chapter.modules[0]?.moduleId ?? null,
      courseId: chapter.subjects[0]?.subject?.courses[0]?.courseId ?? null,
    }));

    return {
      chapters: data,
      total,
      page,
      limit,
    };
  }

  async findBySlug(slug: string) {
    const chapter = await this.prisma.chapter.findFirst({
      where: { slug, status: true },
      include: {
        subjects: {
          where: {
            subject: {
              status: true,
            },
          },
          include: {
            subject: {
              include: {
                courses: true,
              },
            },
          },
        },
        modules: {
          where: {
            module: {
              status: true,
            },
          },
          include: {
            module: true,
          },
        },
      },
    });

    if (!chapter) {
      throw new NotFoundException('Chapter not found');
    }

    return {
      ...chapter,
      subjectId: chapter.subjects[0]?.subjectId ?? null,
      moduleId: chapter.modules[0]?.moduleId ?? null,
      courseId: chapter.subjects[0]?.subject?.courses[0]?.courseId ?? null,
    };
  }

  async findBySubject(subjectId: number) {
    const chapters = await this.prisma.chapter.findMany({
      where: {
        status: true,
        subjects: {
          some: {
            subjectId,
          },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
      include: {
        subjects: {
          where: {
            subject: {
              status: true,
            },
          },
          include: {
            subject: {
              include: {
                courses: true,
              },
            },
          },
        },
        modules: {
          where: {
            module: {
              status: true,
            },
          },
          include: {
            module: true,
          },
        },
      },
    });

    return chapters.map((chapter) => ({
      ...chapter,
      subjectId: chapter.subjects[0]?.subjectId ?? null,
      moduleId: chapter.modules[0]?.moduleId ?? null,
      courseId: chapter.subjects[0]?.subject?.courses[0]?.courseId ?? null,
    }));
  }

  async findByModule(moduleId: number) {
    const chapters = await this.prisma.chapter.findMany({
      where: {
        status: true,
        modules: {
          some: {
            moduleId,
          },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
      include: {
        subjects: {
          where: {
            subject: {
              status: true,
            },
          },
          include: {
            subject: {
              include: {
                courses: true,
              },
            },
          },
        },
        modules: {
          where: {
            module: {
              status: true,
            },
          },
          include: {
            module: true,
          },
        },
      },
    });

    return chapters.map((chapter) => ({
      ...chapter,
      subjectId: chapter.subjects[0]?.subjectId ?? null,
      moduleId: chapter.modules[0]?.moduleId ?? null,
      courseId: chapter.subjects[0]?.subject?.courses[0]?.courseId ?? null,
    }));
  }
  async update(id: number, dto: UpdateChapterDto) {
    const existing = await this.findOne(id);

    let slug = existing.slug;
    if (dto.title && dto.title !== existing.title) {
      slug = await generateUniqueSlugForTable(
        this.prisma,
        'chapter',
        dto.title,
      );
    }

    // Validate new subject if provided
    if (dto.subjectId) {
      const subject = await this.prisma.subject.findFirst({
        where: { id: dto.subjectId, status: true },
      });
      if (!subject) {
        throw new NotFoundException('Subject not found');
      }
    }

    // Validate module-subject consistency
    const targetSubjectId = dto.subjectId !== undefined ? dto.subjectId : existing.subjects[0]?.subjectId;
    const targetModuleId = dto.moduleId !== undefined ? dto.moduleId : existing.modules[0]?.moduleId;

    if (targetModuleId && targetSubjectId) {
      const module = await this.prisma.module.findFirst({
        where: {
          id: targetModuleId,
          subjectId: targetSubjectId,
          status: true,
        },
      });

      if (!module) {
        throw new BadRequestException(
          'Module does not belong to the given subject',
        );
      }
    }

    await this.prisma.chapter.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        slug,
        sortOrder: dto.sortOrder,
      },
    });

    // Update subject association
    if (dto.subjectId !== undefined && dto.subjectId !== existing.subjects[0]?.subjectId) {
      // Remove old subject association
      await this.prisma.subjectChapter.deleteMany({
        where: { chapterId: id },
      });
      if (dto.subjectId !== null) {
        // Add new subject association
        await this.prisma.subjectChapter.create({
          data: {
            subjectId: dto.subjectId,
            chapterId: id,
          },
        });
      }

      // If subject changed and moduleId is not being explicitly updated in this request,
      // we must clear the module association since the old module belongs to the old subject.
      if (dto.moduleId === undefined) {
        await this.prisma.moduleChapter.deleteMany({
          where: { chapterId: id },
        });
      }
    }

    // Update module association
    if (dto.moduleId !== undefined && dto.moduleId !== existing.modules[0]?.moduleId) {
      // Remove old module association
      await this.prisma.moduleChapter.deleteMany({
        where: { chapterId: id },
      });
      if (dto.moduleId !== null) {
        // Add new module association
        await this.prisma.moduleChapter.create({
          data: {
            moduleId: dto.moduleId,
            chapterId: id,
          },
        });
      }
    }

    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.chapter.update({
      where: { id },
      data: { status: false },
    });
  }
}
