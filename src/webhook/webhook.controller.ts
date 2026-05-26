import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import * as crypto from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { Public } from 'src/auth/public.decorator';

@Controller('webhooks')
export class WebhookController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('zoom')
  async handle(
    @Body() body,
    @Headers('x-zm-signature') signature: string,
    @Headers('x-zm-request-timestamp') timestamp: string,
  ) {
    console.log('ZOOM WEBHOOK EVENT:', body.event);

    // =========================================
    // URL VALIDATION
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
    // GET MEETING ID
    // =========================================

    const meetingId = body.payload?.object?.id?.toString();

    if (!meetingId) {
      return {
        success: false,
        message: 'Meeting ID missing',
      };
    }

    // =========================================
    // FIND LIVE CLASS
    // =========================================

    const cls = await this.prisma.live_classes.findFirst({
      where: {
        zoomMeetingId: meetingId,
      },
    });

    if (!cls) {
      return {
        success: true,
      };
    }

    // =========================================
    // meeting.started
    // =========================================

    if (body.event === 'meeting.started') {
      await this.prisma.live_classes.update({
        where: {
          id: cls.id,
        },
        data: {
          status: 'live',
        },
      });
    }

    // =========================================
    // meeting.ended
    // =========================================

    if (body.event === 'meeting.ended') {
      await this.prisma.live_classes.update({
        where: {
          id: cls.id,
        },
        data: {
          status: 'ended',
        },
      });
    }

    // =========================================
    // recording.completed
    // =========================================

    if (body.event === 'recording.completed') {
      const recordings = body.payload?.object?.recording_files || [];

      for (const file of recordings) {
        // only save mp4 videos
        if (file.file_type === 'MP4') {
          await this.prisma.live_class_recordings.create({
            data: {
              classId: cls.id,

              url: file.play_url,

              downloadUrl: file.download_url,

              duration: file.recording_end
                ? Math.floor(
                    (new Date(file.recording_end).getTime() -
                      new Date(file.recording_start).getTime()) /
                      1000,
                  )
                : null,

              recordedAt: body.payload.object.recording_start,

              type: file.file_type,
            },
          });
        }
      }
    }

    return {
      success: true,
    };
  }
}
