import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { generateUniqueCourseSlug } from 'src/shared/generate-unique-slug';
import { generateUniqueSlugForTable } from 'src/shared/generate-unique-slug-for-table';
import { PaginationDto } from 'src/shared/dto/pagination-dto';
import { table } from 'console';
@Injectable()
export class SubjectService {
  constructor(private prisma: PrismaService) {}

  async create(createSubjectDto: CreateSubjectDto) {
    const { name, description, courseIds } = createSubjectDto;

    const slug = await generateUniqueSlugForTable(this.prisma, 'subject', name);

    const subject = await this.prisma.subject.create({
      data: {
        name,
        description,
        slug,
      },
    });

    if (courseIds?.length) {
      await this.prisma.courseSubject.createMany({
        data: courseIds.map((courseId) => ({
          courseId,
          subjectId: subject.id,
        })),
      });
    }

    return this.findOne(subject.id);
  }

  async subjectsByCourseId(courseId: number) {
    return this.prisma.courseSubject.findMany({
      where: {
        courseId,
        subject: { status: true },
      },
      include: {
        subject: true,
      },
    });
  }

  async findAll(paginationDto: PaginationDto) {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.subject.findMany({
        where: {
          status: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip,
        include: {
          courses: {
            include: {
              course: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.subject.count({
        where: {
          status: true,
        },
      }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: number) {
    const subject = await this.prisma.subject.findFirst({
      where: {
        id,
        status: true,
      },
      include: {
        courses: {
          include: {
            course: true,
          },
        },
        chapters: {
          include: {
            chapter: true,
          },
        },
      },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    return subject;
  }

  async findOneBySlug(slug: string) {
    const subject = await this.prisma.subject.findFirst({
      where: {
        slug,
        status: true,
      },
      include: {
        courses: {
          include: {
            course: true,
          },
        },
        chapters: {
          include: {
            chapter: true,
          },
        },
      },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    return subject;
  }

  async update(id: number, updateSubjectDto: UpdateSubjectDto) {
    const existing = await this.findOne(id);
    const { name, description, courseIds } = updateSubjectDto;

    let slug = existing.slug;

    if (name && name !== existing.name) {
      slug = await generateUniqueSlugForTable(this.prisma, 'subject', name);
    }

    await this.prisma.subject.update({
      where: { id },
      data: {
        name,
        description,
        slug,
      },
    });

    if (courseIds) {
      await this.prisma.courseSubject.deleteMany({
        where: { subjectId: id },
      });

      await this.prisma.courseSubject.createMany({
        data: courseIds.map((courseId) => ({
          courseId,
          subjectId: id,
        })),
      });
    }

    return this.findOne(id);
  }

  // ✅ SOFT DELETE
  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.subject.update({
      where: { id },
      data: { status: false },
    });
  }

  async updateStatus(id: number) {
    const subject = await this.findOne(id);

    return this.prisma.subject.update({
      where: { id },
      data: {
        status: !subject.status,
      },
    });
  }

  async findSubjectByName(name: string, id?: number): Promise<boolean> {
    const subject = await this.prisma.subject.findFirst({
      where: {
        name,
        status: true,
        ...(id && { id: { not: id } }),
      },
    });
    return !!subject;
  }
}
