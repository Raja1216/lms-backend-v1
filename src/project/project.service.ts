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
import { PaginationDto } from 'src/shared/dto/pagination-dto';
import { CertificateType, CertificateBrand } from 'src/generated/prisma/enums';
import { CertificateGeneratorService } from 'src/services/certicate-generator/certicate-generator.service';
import { Logger } from '@nestjs/common';
@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly certificateGenerator: CertificateGeneratorService,
  ) {}
  private async findProjectOrThrow(id: number) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        rubrics: true,

        course: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },

        subject: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },

        module: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },

        chapter: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },

        lesson: {
          select: {
            id: true,
            title: true,
            slug: true,
            topicName: true,
          },
        },
      },
    });
    if (!project) {
      throw new NotFoundException(`Project not found`);
    }
    return project;
  }
  async create(dto: CreateProjectDto, teacherId: number) {
    await this.validateProjectHierarchy(dto);

    if (dto.gradingMethod === 'rubric' && dto.rubrics?.length) {
      const totalWeight = dto.rubrics.reduce(
        (sum, rubric) => sum + Number(rubric.weight),
        0,
      );

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

        subjectId: dto.level === 'course' ? null : dto.subjectId,

        moduleId: ['module', 'chapter', 'lesson'].includes(dto.level)
          ? dto.moduleId
          : null,

        chapterId: ['chapter', 'lesson'].includes(dto.level)
          ? dto.chapterId
          : null,

        lessonId: dto.level === 'lesson' ? dto.lessonId : null,

        level: dto.level,

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
              create: dto.rubrics.map((rubric) => ({
                title: rubric.title,
                description: rubric.description,
                weight: rubric.weight,
                maxMarks: rubric.maxMarks,
              })),
            }
          : undefined,
      },

      include: {
        rubrics: true,

        course: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },

        subject: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },

        module: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },

        chapter: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },

        lesson: {
          select: {
            id: true,
            title: true,
            slug: true,
            topicName: true,
          },
        },
      },
    });
  }

  async findAll(query: QueryProjectDto) {
    const {
      page = 1,
      limit = 10,

      courseId,
      subjectId,
      moduleId,
      chapterId,
      lessonId,

      level,
      status,
    } = query;

    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};

    if (courseId) {
      where.courseId = courseId;
    }

    if (subjectId) {
      where.subjectId = subjectId;
    }

    if (moduleId) {
      where.moduleId = moduleId;
    }

    if (chapterId) {
      where.chapterId = chapterId;
    }

    if (lessonId) {
      where.lessonId = lessonId;
    }

    if (level) {
      where.level = level;
    }

    if (status !== undefined) {
      where.status = status;
    }

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where,

        skip,

        take: Number(limit),

        include: {
          rubrics: true,

          course: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },

          subject: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },

          module: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },

          chapter: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },

          lesson: {
            select: {
              id: true,
              title: true,
              slug: true,
              topicName: true,
            },
          },
        },

        orderBy: {
          createdAt: 'desc',
        },
      }),

      this.prisma.project.count({
        where,
      }),
    ]);

    return {
      data,
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }
  async findProjectsByCourseSlug(
    courseSlug: string,
    userId: number,
    paginationDto: PaginationDto,
  ) {
    const course = await this.prisma.course.findUnique({
      where: { slug: courseSlug },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    // If user is not enrolled in the course, they should not see any projects
    const enrollment = await this.prisma.userEnrolledCourse.findFirst({
      where: { courseId: course.id, userId },
    });
    if (!enrollment) {
      throw new NotFoundException('Course not found');
    }
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;
    // return this.prisma.project
    //   .findMany({
    //     where: { courseId: course.id },
    //     include: { rubrics: true, course: { select: { title: true } } },
    //     orderBy: { createdAt: 'desc' },
    //     skip,
    //     take: limit,
    //   })
    //   .then(async (data) => {
    //     const total = await this.prisma.project.count({
    //       where: { courseId: course.id },
    //     });
    //     return { data, total, page, limit };
    //   });

    const data = await this.prisma.project.findMany({
      where: {
        courseId: course.id,
        status: true,
      },

      include: {
        rubrics: true,

        course: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },

        subject: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },

        module: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },

        chapter: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },

        lesson: {
          select: {
            id: true,
            title: true,
            slug: true,
            topicName: true,
          },
        },

        submissions: {
          where: {
            studentId: userId,
          },

          include: {
            files: true,
            grade: true,
          },

          take: 1,
        },
      },

      orderBy: {
        createdAt: 'desc',
      },

      skip,
      take: Number(limit),
    });

    const total = await this.prisma.project.count({
      where: {
        courseId: course.id,
        status: true,
      },
    });

    return {
      data,
      total,
      page: Number(page),
      limit: Number(limit),
    };
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
  async issueProjectCertificateIfEligible(
    submissionId: number,
    gradeId: number,
  ): Promise<void> {
    try {
      // Already issued for this submission?
      const alreadyIssued = await this.prisma.certificate.findFirst({
        where: { projectSubmissionId: submissionId },
      });

      // Load everything needed
      const submission = await this.prisma.projectSubmission.findUnique({
        where: { id: submissionId },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              classGrade: true,
              section: true,
              schoolName: true,
            },
          },
          project: {
            select: {
              title: true,
              course: {
                select: {
                  title: true,
                  grade: true,
                  teachers: {
                    take: 1,
                    include: { teacher: { select: { name: true } } },
                  },
                },
              },
            },
          },
          grade: {
            select: {
              letterGrade: true,
              percentage: true,
              feedback: true,
              teacher: { select: { name: true } },
            },
          },
        },
      });

      if (!submission || !submission.grade) return;

      const student = submission.student;
      const project = submission.project;
      const course = project.course;
      const grade = submission.grade;
      const letterGrade =
        grade.letterGrade ?? this.percentToLetter(Number(grade.percentage));
      const teacherName = grade.teacher.name ?? '';

      const certNumber = this.generateCertNumber();
      const completedDate = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }); // e.g. "17 May 2025"

      // Generate PDF
      const { filePath, fileUrl } =
        await this.certificateGenerator.generateProjectCertificate({
          studentName: student.name ?? 'Student',
          schoolName: student.schoolName ?? '', // school = course name line in template
          projectName: project.title,
          courseName: course.title,
          grade: letterGrade,
          teacherRemarks: grade.feedback ?? '',
          completedDate,
          certificateId: certNumber,
          className: student.classGrade ?? course.grade ?? '',
        });
      if (!alreadyIssued) {
        // Save to certificates table
        await this.prisma.certificate.create({
          data: {
            certificateNumber: certNumber,
            userId: student.id,
            projectSubmissionId: submissionId,
            type: CertificateType.project_completion,
            filePath,
            fileUrl,
            title: `${project.title} — Project Completion`,
            studentName: student.name ?? 'Student',
            className: student.classGrade ?? course.grade ?? '',
            projectTitle: project.title,
            courseName: course.title,
            grade: letterGrade,
            teacherRemarks: grade.feedback ?? '',
            completionDate: new Date(),
            brandLogo: CertificateBrand.edudigm, // adjust per brand
          },
        });
      } else {
        await this.prisma.certificate.update({
          where: { id: alreadyIssued.id },

          data: {
            certificateNumber: certNumber,
            userId: student.id,
            projectSubmissionId: submissionId,
            type: CertificateType.project_completion,
            filePath,
            fileUrl,
            title: `${project.title} — Project Completion`,
            studentName: student.name ?? 'Student',
            className: student.classGrade ?? course.grade ?? '',
            projectTitle: project.title,
            courseName: course.title,
            grade: letterGrade,
            teacherRemarks: grade.feedback ?? '',
            completionDate: new Date(),
            brandLogo: CertificateBrand.edudigm, // adjust per brand
          },
        });
      }

      this.logger.log(
        `Project certificate issued [submission=${submissionId} user=${student.id}]`,
      );
    } catch (err) {
      console.error('PROJECT CERTIFICATE ERROR:', err);

      this.logger.error(
        `Project certificate issuance failed [submission=${submissionId}]`,
        err instanceof Error ? err.stack : String(err),
      );

      throw err;
    }
  }
  private generateCertNumber(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `CERT-${ts}-${rand}`;
  }
  private percentToLetter(pct: number): string {
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C+';
    if (pct >= 40) return 'C';
    if (pct >= 33) return 'D';
    return 'F';
  }
  private async validateProjectHierarchy(dto: {
    courseId: number;
    subjectId?: number | null;
    moduleId?: number | null;
    chapterId?: number | null;
    lessonId?: number | null;
    level: string;
  }) {
    const course = await this.prisma.course.findUnique({
      where: {
        id: dto.courseId,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    switch (dto.level) {
      case 'course': {
        break;
      }

      case 'subject': {
        if (!dto.subjectId) {
          throw new BadRequestException(
            'subjectId is required for subject level project',
          );
        }

        const relation = await this.prisma.courseSubject.findFirst({
          where: {
            courseId: dto.courseId,
            subjectId: dto.subjectId,
          },
        });

        if (!relation) {
          throw new BadRequestException(
            'Subject does not belong to this course',
          );
        }

        break;
      }

      case 'module': {
        if (!dto.subjectId || !dto.moduleId) {
          throw new BadRequestException(
            'subjectId and moduleId are required for module level project',
          );
        }

        const module = await this.prisma.module.findFirst({
          where: {
            id: dto.moduleId,
            subjectId: dto.subjectId,
          },
        });

        if (!module) {
          throw new BadRequestException(
            'Module does not belong to this subject',
          );
        }

        const courseSubject = await this.prisma.courseSubject.findFirst({
          where: {
            courseId: dto.courseId,
            subjectId: dto.subjectId,
          },
        });

        if (!courseSubject) {
          throw new BadRequestException(
            'Subject does not belong to this course',
          );
        }

        break;
      }

      case 'chapter': {
        if (!dto.subjectId || !dto.moduleId || !dto.chapterId) {
          throw new BadRequestException(
            'subjectId, moduleId and chapterId are required for chapter level project',
          );
        }

        const module = await this.prisma.module.findFirst({
          where: {
            id: dto.moduleId,
            subjectId: dto.subjectId,
          },
        });

        if (!module) {
          throw new BadRequestException(
            'Module does not belong to this subject',
          );
        }

        const moduleChapter = await this.prisma.moduleChapter.findFirst({
          where: {
            moduleId: dto.moduleId,
            chapterId: dto.chapterId,
          },
        });

        if (!moduleChapter) {
          throw new BadRequestException(
            'Chapter does not belong to this module',
          );
        }

        const courseSubject = await this.prisma.courseSubject.findFirst({
          where: {
            courseId: dto.courseId,
            subjectId: dto.subjectId,
          },
        });

        if (!courseSubject) {
          throw new BadRequestException(
            'Subject does not belong to this course',
          );
        }

        break;
      }

      case 'lesson': {
        if (
          !dto.subjectId ||
          !dto.moduleId ||
          !dto.chapterId ||
          !dto.lessonId
        ) {
          throw new BadRequestException(
            'subjectId, moduleId, chapterId and lessonId are required for lesson level project',
          );
        }

        const courseSubject = await this.prisma.courseSubject.findFirst({
          where: {
            courseId: dto.courseId,
            subjectId: dto.subjectId,
          },
        });

        if (!courseSubject) {
          throw new BadRequestException(
            'Subject does not belong to this course',
          );
        }

        const module = await this.prisma.module.findFirst({
          where: {
            id: dto.moduleId,
            subjectId: dto.subjectId,
          },
        });

        if (!module) {
          throw new BadRequestException(
            'Module does not belong to this subject',
          );
        }

        const moduleChapter = await this.prisma.moduleChapter.findFirst({
          where: {
            moduleId: dto.moduleId,
            chapterId: dto.chapterId,
          },
        });

        if (!moduleChapter) {
          throw new BadRequestException(
            'Chapter does not belong to this module',
          );
        }

        const lessonChapter = await this.prisma.lessonToChapter.findFirst({
          where: {
            lessonId: dto.lessonId,
            chapterId: dto.chapterId,
          },
        });

        if (!lessonChapter) {
          throw new BadRequestException(
            'Lesson does not belong to this chapter',
          );
        }

        break;
      }

      default:
        throw new BadRequestException('Invalid project level');
    }
  }
}
