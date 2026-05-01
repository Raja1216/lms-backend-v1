import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ZoomService } from 'src/zoom/zoom.service';

@Injectable()
export class LiveClassService {
  constructor(
    private prisma: PrismaService,
    private zoom: ZoomService,
  ) {}

  // 🔥 VALIDATION (COURSE → SUBJECT → CHAPTER → MODULE)
  async validateHierarchy(dto) {
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
    });
    if (!course) throw new NotFoundException('Course not found');

    if (dto.subjectId) {
      const subject = await this.prisma.subject.findFirst({
        where: {
          id: dto.subjectId,
          courses: { some: { courseId: dto.courseId } },
        },
      });
      if (!subject) throw new NotFoundException('Invalid subject');
    }

    if (dto.chapterId) {
      const chapter = await this.prisma.chapter.findFirst({
        where: {
          id: dto.chapterId,
          subjects: {
            some: {
              subject: {
                courses: { some: { courseId: dto.courseId } },
              },
            },
          },
        },
      });
      if (!chapter) throw new NotFoundException('Invalid chapter');
    }

    if (dto.moduleId) {
      const module = await this.prisma.module.findFirst({
        where: {
          id: dto.moduleId,
          subject: {
            courses: { some: { courseId: dto.courseId } },
          },
        },
      });
      if (!module) throw new NotFoundException('Invalid module');
    }
  }

  // ✅ CREATE
  async create(dto, user) {
    await this.validateHierarchy(dto);

    const meeting = await this.zoom.createMeeting({
      title: dto.title,
      scheduledAt: new Date(dto.scheduledAt),
      duration: dto.duration,
      hostEmail: user.email, // ✅ FIX
    });

    return this.prisma.live_classes.create({
      data: {
        title: dto.title,
        description: dto.description,
        courseId: dto.courseId,
        subjectId: dto.subjectId || null,
        chapterId: dto.chapterId || null,
        moduleId: dto.moduleId || null,
        scheduledAt: new Date(dto.scheduledAt),
        duration: dto.duration,
        status: 'scheduled',
        hostId: user.id,

        zoomMeetingId: meeting.id.toString(),
        joinUrl: meeting.join_url,
        startUrl: meeting.start_url,
        password: meeting.password,
      },
    });
  }

  // ✅ LIST
  async findAll(query, user) {
    const where: any = {};

    if (query.courseId) where.courseId = Number(query.courseId);
    if (query.subjectId) where.subjectId = Number(query.subjectId);
    if (query.chapterId) where.chapterId = Number(query.chapterId);
    if (query.moduleId) where.moduleId = Number(query.moduleId);
    if (query.status) where.status = query.status;

    if (query.mine) where.hostId = user.id;

    if (query.upcoming) {
      where.scheduledAt = { gte: new Date() };
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    const [data, total] = await Promise.all([
      this.prisma.live_classes.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { scheduledAt: 'asc' },

        include: {
          host: { select: { id: true, name: true } },
          course: { select: { id: true, title: true } },
          subject: { select: { id: true, name: true } },
          chapter: { select: { id: true, title: true } },
          module: { select: { id: true, title: true } },

          _count: {
            select: {
              attendance: true,
              recordings: true,
            },
          },
        },
      }),

      this.prisma.live_classes.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  // ✅ DETAILS
  async findOne(id: string, user) {
    const cls = await this.prisma.live_classes.findUnique({
      where: { id },
      include: {
        host: true,
        recordings: true,
      },
    });

    if (!cls) throw new NotFoundException();

    return cls;
  }

  // ✅ START
  async start(id: string, user) {
    const cls = await this.prisma.live_classes.findUnique({
      where: { id },
    });

    if (!cls) throw new NotFoundException();
    if (cls.hostId !== user.id)
      throw new ForbiddenException();

    return {
      id,
      status: 'live',
      startUrl: cls.startUrl,
    };
  }

  // ✅ END
  async end(id: string) {
    return this.prisma.live_classes.update({
      where: { id },
      data: { status: 'ended' },
    });
  }

  // ✅ JOIN
  async join(id: string, user) {
    const cls = await this.prisma.live_classes.findUnique({
      where: { id },
    });

    if (!cls) throw new NotFoundException();

    await this.prisma.live_class_attendance.create({
      data: {
        classId: id,
        userId: user.id,
        joinedAt: new Date(),
      },
    });

    return {
      joinUrl: `${cls.joinUrl}&uname=${user.name}`,
      password: cls.password,
    };
  }
}