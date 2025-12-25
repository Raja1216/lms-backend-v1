import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { generateSlug } from 'src/shared/generate-slug';

@Injectable()
export class SubjectService {
  constructor(private prisma: PrismaService) {}

  async create(createSubjectDto: CreateSubjectDto) {
    const { name, description, courseIds } = createSubjectDto;
    const slug = generateSlug(name);
    const subject = await this.prisma.subject.create({
      data: {
        name,
        description,
        slug,
      },
      include: {
        courses: true,
      },
    });
    const courseSubject: any[] = [];
    if (courseIds && courseIds.length > 0) {
      const courses = await this.prisma.course.findMany({
        where: {
          id: { in: courseIds },
        },
      });
      await this.prisma.courseSubject.createMany({
        data: courses.map((course) => ({
          courseId: course.id,
          subjectId: subject.id,
        })),
      });
      courseSubject.push(...courses);
    }
    return { ...subject, courses: courseSubject };
  }

  async subjectsByCourseId(courseId: number) {
    const courseSubjects = await this.prisma.courseSubject.findMany({
      where: { courseId },
      include: { subject: true, course: true },
    });
    return courseSubjects;
  }

  findAll() {
    return `This action returns all subject`;
  }

  async findOne(id: number) {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      include: {
        courses: {
          include: {
            course: {
              include: {
                teachers: {
                  include: {
                    teacher: true,
                  },
                },
              },
            },
          },
        },
        chapters: {
          include: {
            chapter: true,
          },
        },
      },
    });
    return subject;
  }

  async findOneBySlug(slug: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { slug },
      include: {
        courses: {
          include: {
            course: {
              include: {
                teachers: {
                  include: {
                    teacher: true,
                  },
                },
              },
            },
          },
        },
        chapters: {
          include: {
            chapter: true,
          },
        },
      },
    });
    return subject;
  }
  async update(id: number, updateSubjectDto: UpdateSubjectDto) {
    const { name, description, courseIds } = updateSubjectDto;
    const existingSubject = await this.findOne(id);
    if (!existingSubject) {
      throw new NotFoundException('Subject not found');
    }
    let slug = existingSubject?.slug;
    if (name && name !== existingSubject.name) {
      slug = generateSlug(name);
    }
    const updatedSubject = await this.prisma.subject.update({
      where: { id },
      data: {
        name,
        description,
        slug,
      },
      include: {
        courses: true,
      },
    });
    if (courseIds && courseIds.length > 0) {
      // First, remove existing course-subject relations
      await this.prisma.courseSubject.deleteMany({
        where: { subjectId: id },
      });
      // Then, create new relations
      await this.prisma.courseSubject.createMany({
        data: courseIds.map((courseId) => ({
          courseId,
          subjectId: id,
        })),
      });
    }
    return this.findOne(id);
  }

  remove(id: number) {
    return `This action removes a #${id} subject`;
  }

  async updateStatus(id: number) {
    const subject = await this.findOne(id);
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }
    const updatedSubject = await this.prisma.subject.update({
      where: { id },
      data: {
        status: !subject.status,
      },
    });
    return updatedSubject;
  }
  async findSubjectByName(name: string, id?: number): Promise<boolean> {
    const subject = await this.prisma.subject.findFirst({
      where: id
        ? {
            name: name,
            NOT: { id: id },
          }
        : { name: name },
    });
    return !!subject;
  }
}
