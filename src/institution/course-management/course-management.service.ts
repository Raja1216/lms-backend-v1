import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { InstitutionService } from '../institution.service';
import { AssignCourseDto } from './dto/assign-course.dto';
import { EnrollmentSource } from 'src/generated/prisma/enums';
import { EnrollStudentDto } from './dto/enroll-student.dto';
import { AssignTeacherToCourseDto } from './dto/assign-teacher-course.dto';
import { PaginationDto } from 'src/shared/dto/pagination-dto';
@Injectable()
export class CourseManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly institutionService: InstitutionService,
  ) {}
  async getInstitutionCourses(
    institutionId: number,
    userId: number,
    paginationDto: PaginationDto,
  ) {
    const { page = 1, limit = 10, keyword } = paginationDto;
    const skip = (page - 1) * limit;
    await this.institutionService.getInstitutionDetails(institutionId, userId);
    const whereClause = keyword
      ? {
          institutionId,
          course: {
            title: { contains: keyword },
          },
        }
      : { institutionId };
    const [courses, total] = await Promise.all([
      this.prisma.institutionCourse.findMany({
        where: whereClause,
        include: {
          course: {
            select: {
              id: true,
              title: true,
              thumbnail: true,
              grade: true,
              duration: true,
              _count: { select: { userEnrolledCourses: true } },
            },
          },
        },
        orderBy: { purchasedAt: 'desc' },
      }),
      this.prisma.institutionCourse.count({ where: whereClause }),
    ]);

    return { courses, page, limit, total };
  }
  async assignCourse(
    institutionId: number,
    requesterId: number,
    dto: AssignCourseDto,
  ) {
    const { isSuperAdmin, institutionId: extractedInstitutionId } =
      await this.institutionService.checkSuperAdmin(requesterId);
    if (!isSuperAdmin && extractedInstitutionId !== institutionId) {
      throw new ForbiddenException('Access denied to this institution');
    }

    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
    });
    if (!course) throw new NotFoundException('Course not found');

    const existing = await this.prisma.institutionCourse.findUnique({
      where: {
        institutionId_courseId: { institutionId, courseId: dto.courseId },
      },
    });
    if (existing)
      throw new ConflictException(
        'Course already assigned to this institution',
      );

    return this.prisma.institutionCourse.create({
      data: { institutionId, courseId: dto.courseId, seats: dto.seats ?? null },
      include: {
        course: { select: { id: true, title: true, thumbnail: true } },
      },
    });
  }
  async removeCourse(
    institutionId: number,
    courseId: number,
    requesterId: number,
  ) {
    const { isSuperAdmin, institutionId: extractedInstitutionId } =
      await this.institutionService.checkSuperAdmin(requesterId);
    if (!isSuperAdmin && extractedInstitutionId !== institutionId) {
      throw new ForbiddenException('Access denied to this institution');
    }
    const record = await this.prisma.institutionCourse.findUnique({
      where: { institutionId_courseId: { institutionId, courseId } },
    });
    if (!record)
      throw new NotFoundException('Course not assigned to this institution');

    return this.prisma.institutionCourse.delete({
      where: { id: record.id },
    });
  }
  async enrollStudents(
    institutionId: number,
    requesterId: number,
    dto: EnrollStudentDto,
  ) {
    const { isSuperAdmin, institutionId: extractedInstitutionId } =
      await this.institutionService.checkSuperAdmin(requesterId);
    if (!isSuperAdmin && extractedInstitutionId !== institutionId) {
      throw new ForbiddenException('Access denied to this institution');
    }

    // Validate course belongs to institution
    const instCourse = await this.prisma.institutionCourse.findUnique({
      where: {
        institutionId_courseId: { institutionId, courseId: dto.courseId },
      },
    });
    if (!instCourse) {
      throw new BadRequestException(
        'Course is not assigned to this institution',
      );
    }

    // Seat-cap check
    if (instCourse.seats !== null) {
      const enrolled = await this.prisma.userEnrolledCourse.count({
        where: {
          courseId: dto.courseId,
          institutionId,
          sourceType: EnrollmentSource.INSTITUTION,
        },
      });
      if (enrolled + dto.studentIds.length > instCourse.seats) {
        throw new BadRequestException(
          `Seat limit exceeded. Available: ${instCourse.seats - enrolled}`,
        );
      }
    }

    // Validate all are students of this institution
    const members = await this.prisma.institutionMember.findMany({
      where: {
        institutionId,
        userId: { in: dto.studentIds },

        status: true,
      },
    });
    if (members.length !== dto.studentIds.length) {
      throw new BadRequestException(
        'One or more users are not students of this institution',
      );
    }

    // Skip already-enrolled students (idempotent)
    const alreadyEnrolled = await this.prisma.userEnrolledCourse.findMany({
      where: {
        courseId: dto.courseId,
        userId: { in: dto.studentIds },
        sourceType: EnrollmentSource.INSTITUTION,
        institutionId,
      },
      select: { userId: true },
    });
    const enrolledIds = new Set(alreadyEnrolled.map((e) => e.userId));
    const toEnroll = dto.studentIds.filter((id) => !enrolledIds.has(id));

    if (toEnroll.length === 0) {
      return {
        enrolled: 0,
        skipped: dto.studentIds.length,
        message: 'All students already enrolled',
      };
    }

    await this.prisma.userEnrolledCourse.createMany({
      data: toEnroll.map((userId) => ({
        userId,
        courseId: dto.courseId,
        sourceType: EnrollmentSource.INSTITUTION,
        institutionId,
      })),
    });

    return {
      enrolled: toEnroll.length,
      skipped: enrolledIds.size,
      message: `${toEnroll.length} student(s) enrolled successfully`,
    };
  }
  async unenrollStudent(
    institutionId: number,
    courseId: number,
    studentId: number,
    requesterId: number,
  ) {
    const { isSuperAdmin, institutionId: extractedInstitutionId } =
      await this.institutionService.checkSuperAdmin(requesterId);
    if (!isSuperAdmin && extractedInstitutionId !== institutionId) {
      throw new ForbiddenException('Access denied to this institution');
    }

    const enrollment = await this.prisma.userEnrolledCourse.findFirst({
      where: {
        userId: studentId,
        courseId,
        institutionId,
        sourceType: EnrollmentSource.INSTITUTION,
      },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    return this.prisma.userEnrolledCourse.delete({
      where: { id: enrollment.id },
    });
  }

  async assignTeachersToCourse(
    institutionId: number,
    requesterId: number,
    dto: AssignTeacherToCourseDto,
  ) {
    const { isSuperAdmin, institutionId: extractedInstitutionId } =
      await this.institutionService.checkSuperAdmin(requesterId);
    if (!isSuperAdmin && extractedInstitutionId !== institutionId) {
      throw new ForbiddenException('Access denied to this institution');
    }

    // Validate course is institution's
    const instCourse = await this.prisma.institutionCourse.findUnique({
      where: {
        institutionId_courseId: { institutionId, courseId: dto.courseId },
      },
    });
    if (!instCourse) {
      throw new BadRequestException(
        'Course is not assigned to this institution',
      );
    }

    // Validate all are teachers of this institution
    const teachers = await this.prisma.institutionMember.findMany({
      where: {
        institutionId,
        userId: { in: dto.teacherIds },
        status: true,
      },
    });
    if (teachers.length !== dto.teacherIds.length) {
      throw new BadRequestException(
        'One or more users are not teachers of this institution',
      );
    }

    // Skip already-assigned teachers
    const existing = await this.prisma.courseTeacher.findMany({
      where: { courseId: dto.courseId, teacherId: { in: dto.teacherIds } },
      select: { teacherId: true },
    });
    const existingIds = new Set(existing.map((e) => e.teacherId));
    const toAssign = dto.teacherIds.filter((id) => !existingIds.has(id));

    if (toAssign.length === 0) {
      return {
        assigned: 0,
        skipped: dto.teacherIds.length,
        message: 'All teachers already assigned',
      };
    }

    await this.prisma.courseTeacher.createMany({
      data: toAssign.map((teacherId) => ({
        courseId: dto.courseId,
        teacherId,
      })),
    });

    return {
      assigned: toAssign.length,
      skipped: existingIds.size,
      message: `${toAssign.length} teacher(s) assigned successfully`,
    };
  }

  async removeTeacherFromCourse(
    institutionId: number,
    courseId: number,
    teacherId: number,
    requesterId: number,
  ) {
    const { isSuperAdmin, institutionId: extractedInstitutionId } =
      await this.institutionService.checkSuperAdmin(requesterId);
    if (!isSuperAdmin && extractedInstitutionId !== institutionId) {
      throw new ForbiddenException('Access denied to this institution');
    }

    const record = await this.prisma.courseTeacher.findFirst({
      where: { courseId, teacherId },
    });
    if (!record)
      throw new NotFoundException('Teacher is not assigned to this course');

    return this.prisma.courseTeacher.delete({ where: { id: record.id } });
  }

  async getTeacherStudents(teacherId: number, paginationDto: PaginationDto) {
    const { courseId } = paginationDto;
    // Resolve which institution this teacher belongs to
    const membership = await this.prisma.institutionMember.findFirst({
      where: {
        userId: teacherId,
        status: true,
        user: {
          roles: {
            some: {
              name: 'teacher',
            },
          },
        },
      },
    });
    if (!membership)
      throw new ForbiddenException('Teacher has no institution membership');

    const { institutionId } = membership;

    // All students of this institution (optionally scoped to a course)
    const where: any = {
      institutionId,
      user: {
        OR: [
          {
            roles: {
              some: {
                name: 'student',
              },
            },
          },
          {
            roles: {
              none: {},
            },
          },
        ],
      },

      status: true,
    };

    if (courseId) {
      // Only students enrolled in the specific course via this institution
      const enrolled = await this.prisma.userEnrolledCourse.findMany({
        where: {
          courseId,
          institutionId,
          sourceType: EnrollmentSource.INSTITUTION,
        },
        select: { userId: true },
      });
      where.userId = { in: enrolled.map((e) => e.userId) };
    }

    return this.prisma.institutionMember.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            classGrade: true,
          },
        },
      },
    });
  }

  async getTeacherSubmissions(teacherId: number, projectId: number) {
    const membership = await this.prisma.institutionMember.findFirst({
      where: {
        userId: teacherId,
        status: true,
        user: {
          roles: {
            some: {
              name: 'teacher',
            },
          },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Teacher has no institution membership');
    }

    const { institutionId } = membership;

    // Students of this institution
    const institutionStudents = await this.prisma.institutionMember.findMany({
      where: {
        institutionId,
        status: true,
        user: {
          OR: [
            {
              roles: {
                some: {
                  name: 'student',
                },
              },
            },
            {
              roles: {
                none: {},
              },
            },
          ],
        },
      },
      select: { userId: true },
    });
    const studentIds = institutionStudents.map((m) => m.userId);

    return this.prisma.projectSubmission.findMany({
      where: { projectId, studentId: { in: studentIds } },
      include: {
        student: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        files: true,
        grade: true,
      },
    });
  }
}
