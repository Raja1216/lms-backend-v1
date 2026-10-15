
import {
  BadGatewayException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface Msg91Response {
  type?: string;
  message?: string;
  request_id?: string;
}

@Injectable()
export class Msg91Service {
  private readonly logger = new Logger(Msg91Service.name);
  private readonly baseUrl = 'https://control.msg91.com/api/v5/otp';

  constructor(private readonly config: ConfigService) {}

  private get authKey(): string {
    return this.config.getOrThrow<string>('MSG91_AUTH_KEY');
  }

  private get templateId(): string {
    return this.config.getOrThrow<string>(
      'MSG91_OTP_TEMPLATE_ID',
    );
  }

  private formatMobile(
    mobile: string,
    mobilePrefix: string,
  ): string {
    const number = mobile.replace(/\D/g, '');
    const prefix = mobilePrefix.replace(/\D/g, '');

    if (!number || !prefix) {
      throw new UnauthorizedException('Invalid mobile number');
    }

    return `${prefix}${number}`;
  }

  async sendOtp(mobile: string, mobilePrefix: string) {
    const fullMobile = this.formatMobile(mobile, mobilePrefix);

    try {
      const response = await axios.post<Msg91Response>(
        this.baseUrl,
        {},
        {
          params: {
            template_id: this.templateId,
            mobile: fullMobile,
          },
          headers: {
            authkey: this.authKey,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );

      if (response.data?.type !== 'success') {
        this.logger.warn(
          `MSG91 send rejected: ${response.data?.message}`,
        );
        throw new BadGatewayException('Unable to send OTP');
      }

      this.logger.log(`MSG91 accepted OTP request`);

      return {
        success: true,
        expiresInSeconds:
          Number(this.config.get('MSG91_OTP_EXPIRY', 5)) * 60,
      };
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;

      if (axios.isAxiosError(error)) {
        this.logger.error(
          `MSG91 send failed: ${error.response?.status ?? error.message}`,
        );
      }

      throw new BadGatewayException('OTP provider unavailable');
    }
  }

  async verifyOtp(
    mobile: string,
    mobilePrefix: string,
    otp: string,
  ): Promise<boolean> {
    const fullMobile = this.formatMobile(mobile, mobilePrefix);

    try {
      const response = await axios.get<Msg91Response>(
        `${this.baseUrl}/verify`,
        {
          params: {
            mobile: fullMobile,
            otp,
          },
          headers: {
            authkey: this.authKey,
          },
          timeout: 10000,
        },
      );

      if (
        response.data?.type === 'success' &&
        response.data?.message === 'OTP verified success'
      ) {
        return true;
      }

      throw new UnauthorizedException('Invalid or expired OTP');
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;

      if (axios.isAxiosError(error)) {
        if (
          error.response?.status === 400 ||
          error.response?.status === 422
        ) {
          throw new UnauthorizedException('Invalid or expired OTP');
        }

        this.logger.error(
          `MSG91 verification failed: ${error.response?.status ?? error.message}`,
        );
      }

      throw new BadGatewayException('Unable to verify OTP');
    }
  }
}
