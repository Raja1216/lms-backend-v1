import {
  Controller,
  Post,
  Body,
  Headers,
} from '@nestjs/common';

import * as crypto from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { Public } from 'src/auth/public.decorator';

@Controller('webhooks')
export class WebhookController {
  constructor(private prisma: PrismaService) {}
  @Public()
  @Post('zoom')
  async handle(
    @Body() body,
    @Headers('x-zm-signature') signature: string,
    @Headers('x-zm-request-timestamp') timestamp: string,
  ) {
    // =========================================
    // ✅ ZOOM URL VALIDATION
    // =========================================

    if (body.event === 'endpoint.url_validation') {
      const hashForValidate = crypto
        .createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET!)
        .update(body.payload.plainToken)
        .digest('hex');

      return {
        plainToken: body.payload.plainToken,
        encryptedToken: hashForValidate,
      };
    }

    // =========================================
    // ✅ GET MEETING ID
    // =========================================

    const meetingId = body.payload?.object?.id?.toString();

    if (!meetingId) {
      return { success: false };
    }

    // =========================================
    // ✅ FIND CLASS
    // =========================================

    const cls = await this.prisma.live_classes.findFirst({
      where: {
        zoomMeetingId: meetingId,
      },
    });

    if (!cls) {
      return { success: true };
    }

    // =========================================
    // ✅ MEETING STARTED
    // =========================================

    if (body.event === 'meeting.started') {
      await this.prisma.live_classes.update({
        where: { id: cls.id },
        data: {
          status: 'live',
        },
      });
    }

    // =========================================
    // ✅ MEETING ENDED
    // =========================================

    if (body.event === 'meeting.ended') {
      await this.prisma.live_classes.update({
        where: { id: cls.id },
        data: {
          status: 'ended',
        },
      });
    }

    // =========================================
    // ✅ RECORDING COMPLETED
    // =========================================

    if (body.event === 'recording.completed') {
      const files = body.payload.object.recording_files || [];

      for (const file of files) {
        try {
          // avoid duplicate insert
          const exists =
            await this.prisma.live_class_recordings.findFirst({
              where: {
                classId: cls.id,
                downloadUrl: file.download_url,
              },
            });

          if (exists) {
            continue;
          }

          // calculate duration
          let duration = 0;

          if (
            file.recording_start &&
            file.recording_end
          ) {
            duration = Math.floor(
              (new Date(file.recording_end).getTime() -
                new Date(file.recording_start).getTime()) /
                1000,
            );
          }

          await this.prisma.live_class_recordings.create({
            data: {
              classId: cls.id,

              url: file.play_url,

              downloadUrl: file.download_url,

              duration,

              recordedAt: file.recording_start
                ? new Date(file.recording_start)
                : null,

              type: file.file_type || 'MP4',
            },
          });
        } catch (err) {
          console.log('Recording save failed', err);
        }
      }
    }

    return {
      success: true,
    };
  }
}