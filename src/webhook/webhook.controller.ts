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
    console.log('ZOOM WEBHOOK BODY:', body);

    // =========================================
    // ✅ URL VALIDATION
    // =========================================

    if (body.event === 'endpoint.url_validation') {
      const hashForValidate = crypto
        .createHmac(
          'sha256',
          process.env.ZOOM_WEBHOOK_SECRET!,
        )
        .update(body.payload.plainToken)
        .digest('hex');

      return {
        plainToken: body.payload.plainToken,
        encryptedToken: hashForValidate,
      };
    }

    // =========================================
    // ✅ NOW GET MEETING ID
    // =========================================

    const meetingId =
      body.payload?.object?.id?.toString();

    if (!meetingId) {
      return {
        success: false,
        message: 'Meeting ID missing',
      };
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
    // meeting.started
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
    // meeting.ended
    // =========================================

    if (body.event === 'meeting.ended') {
      await this.prisma.live_classes.update({
        where: { id: cls.id },
        data: {
          status: 'ended',
        },
      });
    }

    return {
      success: true,
    };
  }
}