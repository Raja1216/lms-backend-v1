import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ZoomService } from '../zoom/zoom.service';

@Injectable()
export class LiveClassService {
  constructor(
    private prisma: PrismaService,
    private zoomService: ZoomService,
  ) {}

  async create(dto: any, user: any) {
    const meeting = await this.zoomService.createMeeting({
      title: dto.title,
      scheduledAt: new Date(dto.scheduledAt),
      duration: dto.duration,
      hostEmail: user.email,
    });

    return this.prisma.live_classes.create({
      data: {
        title: dto.title,
        description: dto.description,
        courseId: dto.courseId,
        subjectId: dto.subjectId,
        chapterId: dto.chapterId,
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

  async join(classId: string, user: any) {
    const cls = await this.prisma.live_classes.findUnique({
      where: { id: classId },
    });

    await this.prisma.live_class_attendance.create({
      data: {
        classId,
        userId: user.id,
        joinedAt: new Date(),
      },
    });

    return {
      joinUrl: `${cls.joinUrl}&uname=${user.name}`,
    };
  }

  async start(classId: string, user: any) {
    const cls = await this.prisma.live_classes.findUnique({
      where: { id: classId },
    });

    if (cls.hostId !== user.id) {
      throw new ForbiddenException('Not allowed');
    }

    return {
      startUrl: cls.startUrl,
    };
  }

  async end(classId: string) {
    return this.prisma.live_classes.update({
      where: { id: classId },
      data: { status: 'ended' },
    });
  }
}