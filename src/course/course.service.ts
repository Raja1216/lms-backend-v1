import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { generateSlug } from 'src/shared/generate-slug';
import { Base64FileUtil } from 'src/utils/base64-file.util';
import dotenv from 'dotenv';
import path from 'path/win32';
import { PaginationDto } from 'src/shared/dto/pagination-dto';
import { User } from 'src/generated/prisma/browser';
dotenv.config();

@Injectable()
export class CourseService {
  constructor(private prisma: PrismaService) {}
  async create(createCourseDto: CreateCourseDto) {
    const {
      title,
      description,
      thumbnail,
      grade,
      duration,
      price,
      discountedPrice,
      teacherIds,
    } = createCourseDto;
    let thumbnailPath = thumbnail; //Assume Base64 File
    if (thumbnail.startsWith('data:')) {
      const savedFile = await Base64FileUtil.saveBase64File(
        thumbnail,
        'upload/course-thumbnails',
      );
      const relativePath = path.posix.join(
        'uploads/category-icons',
        savedFile.fileName,
      );
      thumbnailPath = process.env.APP_URL + '/' + relativePath;
    }
    const slug = generateSlug(title);
    const course = await this.prisma.course.create({
      data: {
        title,
        description,
        thumbnail: thumbnailPath,
        grade,
        duration,
        price,
        discountedPrice,
        slug,
      },
    });
    let assignTeachers: any[] = [];
    for (const teacherId of teacherIds) {
      const assignTeacher = await this.prisma.courseTeacher.create({
        data: {
          courseId: course.id,
          teacherId: teacherId,
        },
      });
      assignTeachers.push(assignTeacher);
    }
    return { ...course, teachers: assignTeachers };
  }

  async findAll(paginationDto: PaginationDto) {
    const { page = 1, limit = 10, keyword = null } = paginationDto;
    console.log('keyword', keyword);
    const skip = (page - 1) * limit;
    const whereClause = keyword
      ? {
          OR: [
            { title: { contains: keyword } },
            { slug: { contains: keyword } },
            { description: { contains: keyword } },
          ],
        }
      : {};
    const courses = await this.prisma.course.findMany({
      where: whereClause,

      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        teachers: {
          include: {
            teacher: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        subjects: {
          select: {
            id: true,
            subject: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });
    const total = await this.prisma.course.count({
      where: whereClause,
    });
    return { data: courses, total };
  }

  async findOne(id: number) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        teachers: {
          include: {
            teacher: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        subjects: {
          select: {
            id: true,
            subject: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });
    return course;
  }

  async update(id: number, updateCourseDto: UpdateCourseDto) {
    const existingCourse = await this.findOne(id);

    if (!existingCourse) {
      throw new Error('Course not found');
    }
    const {
      title,
      description,
      thumbnail,
      grade,
      duration,
      price,
      discountedPrice,
      teacherIds,
    } = updateCourseDto;
    let thumbnailPath = existingCourse.thumbnail; //Assume Base64 File
    let slug = existingCourse.slug;
    if (thumbnail) {
      if (thumbnail.startsWith('data:')) {
        const savedFile = await Base64FileUtil.saveBase64File(
          thumbnail,
          'upload/course-thumbnails',
        );
        const relativePath = path.posix.join(
          'uploads/category-icons',
          savedFile.fileName,
        );
        thumbnailPath = process.env.APP_URL + '/' + relativePath;
      } else {
        thumbnailPath = thumbnail;
      }
    }
    if (title) {
      slug = generateSlug(title);
    }
    const updatedCourse = await this.prisma.course.update({
      where: { id },
      data: {
        title,
        description,
        thumbnail: thumbnailPath,
        grade,
        duration,
        price,
        discountedPrice,
        slug,
      },
    });
    const updateAssignedTeachers: any[] = [];
    if (teacherIds) {
      // Remove existing teachers
      await this.prisma.courseTeacher.deleteMany({
        where: { courseId: id },
      });
      // Assign new teachers
      for (const teacherId of teacherIds) {
        const updatedTeacher = await this.prisma.courseTeacher.create({
          data: {
            courseId: id,
            teacherId: teacherId,
          },
        });
        updateAssignedTeachers.push(updatedTeacher);
      }
    }
    return { ...updatedCourse, teachers: updateAssignedTeachers };
  }

  async updateStatus(id: number) {
    const existingCourse = await this.findOne(id);

    if (!existingCourse) {
      throw new Error('Course not found');
    }

    const updatedCourse = await this.prisma.course.update({
      where: { id },
      data: {
        status: !existingCourse.status,
      },
    });

    return updatedCourse;
  }
  async findCourseBySlug(slug: string) {
    const course = await this.prisma.course.findUnique({
      where: { slug },
      include: {
        teachers: {
          include: {
            teacher: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        subjects: {
          select: {
            id: true,
            subject: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });
    return course;
  }
  async remove(id: number) {
    return `This action removes a #${id} course`;
  }
  async findCourseByName(name: string, id?: number): Promise<Boolean> {
    const course = await this.prisma.course.findFirst({
      where: {
        title: name,
        ...(id && { id: { not: id } }),
      },
    });
    if (course) {
      return true;
    }
    return false;
  }

  async enrollInCourse(user: User, courseSlug: string) {
    // chek the valid course
    const course = await this.prisma.course.findUnique({
      where: {
        slug: courseSlug,
        status: true,
      },
    });
    if (!course) {
      throw new BadRequestException('Invalid course');
    }
    // check already enrolled
    const existingEnrollment = await this.prisma.userEnrolledCourse.findFirst({
      where: {
        userId: user.id,
        courseId: course.id,
      },
    });
    if (existingEnrollment) {
      throw new BadRequestException('Already enrolled in this course');
    }
    // create payment record with status completed for free course
    const payment = await this.prisma.payment.create({
      data: {
        userId: user.id,
        courseId: course.id,
        amount: course.discountedPrice,
        status: 'completed',
        currency: 'INR',
      },
    });
    //create enrollment

    const enrollment = await this.prisma.userEnrolledCourse.create({
      data: {
        userId: user.id,
        courseId: course.id,
        paymentId: payment.id,
      },
    });

    return enrollment;
  }
}
