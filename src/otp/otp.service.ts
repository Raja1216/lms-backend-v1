import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SendMobileOtpDto, SendOtpDto } from 'src/auth/dto/send-otp.dto';
import { BadRequestException } from '@nestjs/common';
import { Msg91Service } from 'src/msg91/msg91.service';

@Injectable()
export class OtpService {
  constructor(
    private prisma: PrismaService,
    // private mailerService: MailerService,
    private readonly msg91Service: Msg91Service,
  ) {}

  async sendOrResendOtp(dto: SendOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const existingOtp = await this.prisma.userOtp.findUnique({
      where: { email: dto.email },
    });

    //  60-second cooldown
    if (existingOtp) {
      const diffSeconds =
        (Date.now() - new Date(existingOtp.updatedAt).getTime()) / 1000;

      if (diffSeconds < 60) {
        throw new BadRequestException(
          'Please wait 60 seconds before resending OTP',
        );
      }
    }

    // const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otp = '123456'; // For testing purposes

    // Send OTP via email (mocked here)
    // await this.mailerService.sendMail({
    //   to: dto.email,
    //   subject: 'Your OTP Code',
    //   text: `Your OTP code is ${otp}. It will expire in 5 minutes.`,
    // });

    // Upsert OTP in the database

    await this.prisma.userOtp.upsert({
      where: { email: dto.email },
      update: {
        code: otp,
        type: 'email',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        failedAttempts: 0,
        resend: { increment: 1 },
      },
      create: {
        email: dto.email,
        type: 'email',
        code: otp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    return {
      status: 'success',
      message: 'OTP sent successfully',
    };
  }

  async sendOrResendMobileOtp(dto: SendMobileOtpDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        mobile: dto.mobile,
        mobile_prefix: dto.mobilePrefix,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Send real OTP using MSG91
    const result = await this.msg91Service.sendOtp(
      dto.mobile,
      dto.mobilePrefix,
    );

    return result;
  }

  async validateMobileOtp(
    mobile: string,
    otp: string,
    mobilePrefix: string,
  ): Promise<boolean> {
    // Verify OTP directly with MSG91
    return await this.msg91Service.verifyOtp(mobile, mobilePrefix, otp);
  }

  async validateOtp(email: string, otp: string): Promise<boolean> {
    const userOtp = await this.prisma.userOtp.findUnique({
      where: { email },
    });

    if (
      !userOtp ||
      userOtp.code !== otp ||
      userOtp.expiresAt < new Date() ||
      userOtp.failedAttempts >= 5
    ) {
      if (userOtp) {
        await this.prisma.userOtp.update({
          where: { email },
          data: { failedAttempts: { increment: 1 } },
        });
      }
      return false;
    }

    await this.prisma.userOtp.delete({
      where: { email },
    });

    return true;
  }
}
