import { Controller, Post, Body } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('webhooks')
export class WebhookController {
  constructor(private prisma: PrismaService) {}

  @Post('zoom')
  async handle(@Body() body) {
    const event = body.event;
    const meetingId = body.payload?.object?.id;

    const cls = await this.prisma.live_classes.findFirst({
      where: { zoomMeetingId: meetingId?.toString() },
    });

    if (!cls) return { status: true };

    if (event === 'meeting.started') {
      await this.prisma.live_classes.update({
        where: { id: cls.id },
        data: { status: 'live' },
      });
    }

    if (event === 'meeting.ended') {
      await this.prisma.live_classes.update({
        where: { id: cls.id },
        data: { status: 'ended' },
      });
    }

    if (event === 'recording.completed') {
      const files = body.payload.object.recording_files;

      for (const file of files) {
        await this.prisma.live_class_recordings.create({
          data: {
            classId: cls.id,
            url: file.play_url,
            downloadUrl: file.download_url,
            duration:
              file.recording_end - file.recording_start,
          },
        });
      }
    }

    return { status: true };
  }
}