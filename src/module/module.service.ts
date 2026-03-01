import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { generateUniqueCourseSlug } from 'src/shared/generate-unique-slug';
import { generateUniqueSlugForTable } from 'src/shared/generate-unique-slug-for-table';
import { PaginationDto } from 'src/shared/dto/pagination-dto';

@Injectable()
export class ModuleService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateModuleDto) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: dto.subjectId, status: true },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    const slug = await generateUniqueSlugForTable(
      this.prisma,
      'module',
      dto.title,
    );

    return this.prisma.module.create({
      data: {
        title: dto.title,
        description: dto.description,
        slug,
        subjectId: dto.subjectId,
      },
    });
  }
  async findAll(paginationDto: PaginationDto) {
    const { keyword, page = 1, limit = 10 } = paginationDto;
    const skip=(page-1)*limit;
    const modules= await this.prisma.module.findMany({
      where: {
        title: {
          contains: keyword,
        },
        status: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      skip,
      take: limit,
    });
    const total= await this.prisma.module.count({
      where: {
        title: {
          contains: keyword,
        },
        status: true,
      },
    });
    return {modules,total, page, limit};
  }
  async findBySubject(subjectId: number) {
    return this.prisma.module.findMany({
      where: {
        subjectId,
        status: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        chapters: {
          include: {
            chapter: true,
          },
        },
      },
    });
  }

  async findBySlug(slug: string) {
    const module = await this.prisma.module.findFirst({
      where: {
        slug,
        status: true,
      },
      include: {
        subject: true,
        chapters: {
          include: {
            chapter: true,
          },
        },
      },
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    return module;
  }

  async update(id: number, dto: UpdateModuleDto) {
    const existing = await this.prisma.module.findFirst({
      where: { id, status: true },
    });

    if (!existing) {
      throw new NotFoundException('Module not found');
    }

    let slug = existing.slug;
    if (dto.title && dto.title !== existing.title) {
      slug = await generateUniqueSlugForTable(this.prisma, 'module', dto.title);
    }

    return this.prisma.module.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        slug,
      },
    });
  }

  // ✅ SOFT DELETE
  async remove(id: number) {
    const module = await this.prisma.module.findFirst({
      where: { id, status: true },
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    return this.prisma.module.update({
      where: { id },
      data: { status: false },
    });
  }
}
