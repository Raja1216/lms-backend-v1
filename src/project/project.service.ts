import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectDto } from './dto/query-project.dto';
import { PrismaService } from '../prisma/prisma.service';
import { generateUniqueSlugForTable } from 'src/shared/generate-unique-slug-for-table';
@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}
  private async findProjectOrThrow(id: number) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { rubrics: true },
    });
    if (!project) {
      throw new NotFoundException(`Project not found`);
    }
    return project;
  }
  async create(dto: CreateProjectDto, teacherId: number) {
    // Validate course exists
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
    });
    if (!course) throw new NotFoundException('Course not found');

    // Validate rubric weights sum to 100 if rubric grading
    if (dto.gradingMethod === 'rubric' && dto.rubrics?.length) {
      const totalWeight = dto.rubrics.reduce((s, r) => s + r.weight, 0);
      if (Math.round(totalWeight) !== 100) {
        throw new BadRequestException('Rubric weights must sum to 100');
      }
    }
    const projectSlug = await generateUniqueSlugForTable(
      this.prisma,
      'project',
      dto.title,
    );
    return this.prisma.project.create({
      data: {
        courseId: dto.courseId,
        createdBy: teacherId,
        title: dto.title,
        slug: projectSlug,
        description: dto.description,
        submissionType: dto.submissionType,
        deadline: new Date(dto.deadline),
        maxMarks: dto.maxMarks,
        gradingMethod: dto.gradingMethod,
        weightPercent: dto.weightPercent ?? 0,
        allowLate: dto.allowLate ?? false,
        maxFileSizeMb: dto.maxFileSizeMb ?? 50,
        rubrics: dto.rubrics?.length
          ? {
              create: dto.rubrics.map((r) => ({
                title: r.title,
                description: r.description,
                weight: r.weight,
                maxMarks: r.maxMarks,
              })),
            }
          : undefined,
      },
      include: { rubrics: true },
    });
  }

  async findAll(query: QueryProjectDto) {
    const { page = 1, limit = 10, courseId, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (courseId) where.courseId = courseId;
    if (status !== undefined) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        include: { rubrics: true, course: { select: { title: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.project.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: number) {
    return this.findProjectOrThrow(id);
  }

  async update(id: number, dto: UpdateProjectDto, userId: number) {
    const project = await this.findProjectOrThrow(id);
    const userRoles = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { roles: true },
    });
    // Only the creator teacher can update
    // roles name does not include 'Super Admin' because they can update any project, but not all projects are created by Super Admins
    if (
      project.createdBy !== userId &&
      !userRoles?.roles?.some((role) => role.name === 'Super Admin')
    ) {
      throw new ForbiddenException('Only the project creator can update it');
    }

    if (dto.gradingMethod === 'rubric' && dto.rubrics?.length) {
      const totalWeight = dto.rubrics.reduce((s, r) => s + r.weight, 0);
      if (Math.round(totalWeight) !== 100) {
        throw new BadRequestException('Rubric weights must sum to 100');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Replace rubrics if provided
      if (dto.rubrics !== undefined) {
        await tx.projectRubric.deleteMany({ where: { projectId: id } });
      }

      return tx.project.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          submissionType: dto.submissionType,
          deadline: dto.deadline ? new Date(dto.deadline) : undefined,
          maxMarks: dto.maxMarks,
          gradingMethod: dto.gradingMethod,
          weightPercent: dto.weightPercent,
          allowLate: dto.allowLate,
          maxFileSizeMb: dto.maxFileSizeMb,
          status: (dto as any).status,
          rubrics: dto.rubrics?.length
            ? { create: dto.rubrics.map((r) => ({ ...r })) }
            : undefined,
        },
        include: { rubrics: true },
      });
    });
  }

  async remove(id: number, userId: number) {
    const project = await this.findProjectOrThrow(id);
    const userRoles = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { roles: true },
    });
    if (
      project.createdBy !== userId &&
      !userRoles?.roles?.some((role) => role.name === 'Super Admin')
    ) {
      throw new ForbiddenException('Only the project creator can delete it');
    }
    await this.prisma.project.delete({ where: { id } });
    return { id };
  }

  async upsertGradeScale(
    courseId: number,
    bands: { minPercent: number; maxPercent: number; letterGrade: string }[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Upsert scale header
      const scale = await tx.gradeScale.upsert({
        where: { courseId },
        create: { courseId },
        update: {},
      });
      // Replace bands
      await tx.gradeScaleBand.deleteMany({ where: { scaleId: scale.id } });
      await tx.gradeScaleBand.createMany({
        data: bands.map((b) => ({
          scaleId: scale.id,
          minPercent: b.minPercent,
          maxPercent: b.maxPercent,
          letterGrade: b.letterGrade as any,
        })),
      });
      return tx.gradeScale.findUnique({
        where: { id: scale.id },
        include: { bands: true },
      });
    });
  }

  async getGradeScale(courseId: number) {
    const scale = await this.prisma.gradeScale.findUnique({
      where: { courseId },
      include: { bands: { orderBy: { minPercent: 'desc' } } },
    });
    if (!scale) throw new NotFoundException('No grade scale for this course');
    return scale;
  }
}
