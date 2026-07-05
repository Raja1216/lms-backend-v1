import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { RazorpayService } from 'src/razorpay/razorpay.service';
import { PublicCheckoutDto } from './dto/public-checkout.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { VerifyPublicPaymentDto } from './dto/verify-public-payment.dto';
import { Payment, UserEnrolledCourse } from 'src/generated/prisma/client';

@Injectable()
export class PublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayService: RazorpayService,
    private readonly jwt: JwtService,
    private activityLogService: ActivityLogService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | FEATURED COURSES
  |--------------------------------------------------------------------------
  */

  async getFeaturedCourses(limit: number = 6) {
    const courses = await this.prisma.course.findMany({
      where: {
        status: true,
        isFeatured: true,
      },

      take: limit,

      orderBy: [
        {
          isLaunch: 'desc',
        },
        {
          launchDate: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],

      include: {
        userEnrolledCourses: true,
      },
    });

    return {
      status: true,

      data: courses.map((course) => ({
        id: course.id,

        slug: course.slug,

        title: course.title,

        tagline: course.shortTagline,

        thumbnail: course.thumbnail,

        preview_video_url: course.previewVideoUrl,

        price: Number(course.discountedPrice),

        original_price: Number(course.price),

        class_level: course.grade,

        is_launch: course.isLaunch,

        launch_date: course.launchDate,

        rating: course.rating,

        students_count: course.userEnrolledCourses.length,
      })),
    };
  }

  async getCourseDetails(slug: string) {
    const course = await this.prisma.course.findFirst({
      where: {
        slug,
        status: true,
      },

      include: {
        teachers: {
          include: {
            teacher: {
              select: {
                id: true,
                name: true,
                avatar: true,
                about: true,
              },
            },
          },
        },

        subjects: {
          include: {
            subject: {
              include: {
                chapters: true,
              },
            },
          },
        },

        userEnrolledCourses: true,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return {
      status: true,

      data: {
        id: course.id,

        slug: course.slug,

        title: course.title,

        description: course.description,

        thumbnail: course.thumbnail,

        preview_video_url: course.previewVideoUrl,

        price: Number(course.discountedPrice),

        original_price: Number(course.price),

        currency: 'INR',

        class_level: course.grade,

        duration: course.duration,

        language: course.language,

        what_you_learn: course.whatYouLearn,

        requirements: course.requirements,

        rating: course.rating,

        students_count: course.userEnrolledCourses.length,

        is_launch: course.isLaunch,

        instructor: course.teachers.map((teacher) => ({
          id: teacher.teacher.id,
          name: teacher.teacher.name,
          avatar: teacher.teacher.avatar,
          about: teacher.teacher.about,
        })),

        syllabus_preview: course.subjects.map((subject) => ({
          subject: subject.subject.name,

          chapters_count: subject.subject.chapters.length,
        })),
      },
    };
  }

  async checkout(dto: PublicCheckoutDto) {
    /*
  |--------------------------------------------------------------------------
  | COURSE
  |--------------------------------------------------------------------------
  */

    const course = await this.prisma.course.findFirst({
      where: {
        id: dto.courseId,
        status: true,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    /*
  |--------------------------------------------------------------------------
  | FIND EXISTING USER
  |--------------------------------------------------------------------------
  */

    const existingUser = await this.prisma.user.findFirst({
      where: {
        mobile: dto.mobileNumber,
        mobile_prefix: dto.mobilePrefix,
      },
    });

    /*
  /*
|--------------------------------------------------------------------------
| EXISTING USER VALIDATION
|--------------------------------------------------------------------------
*/

    if (existingUser) {
      const passwordMatched = await bcrypt.compare(
        dto.password,
        existingUser.password,
      );

      if (!passwordMatched) {
        throw new UnauthorizedException('Invalid mobile number or password');
      }

      const enrolled = await this.prisma.userEnrolledCourse.findFirst({
        where: {
          userId: existingUser.id,
          courseId: dto.courseId,
        },
      });

      if (enrolled) {
        throw new ConflictException('You are already enrolled in this course');
      }

      // Always use the registered user's information
      dto.email = existingUser.email ?? dto.email;
      dto.fullName = existingUser.name ?? dto.fullName;
      dto.classGrade = existingUser.classGrade ?? dto.classGrade;
      dto.schoolName = existingUser.schoolName ?? dto.schoolName;

      // Update profile if user changed values
      await this.prisma.user.update({
        where: {
          id: existingUser.id,
        },
        data: {
          name: dto.fullName,
          classGrade: dto.classGrade,
          schoolName: dto.schoolName,
        },
      });
    }
    /*
  |--------------------------------------------------------------------------
  | NEW USER VALIDATION
  |--------------------------------------------------------------------------
  */

    if (!existingUser) {
      const duplicateEmail = await this.prisma.user.findFirst({
        where: {
          email: dto.email,
        },
      });

      if (duplicateEmail) {
        throw new ConflictException('Email already registered');
      }

      const duplicateMobile = await this.prisma.user.findFirst({
        where: {
          mobile: dto.mobileNumber,
          mobile_prefix: dto.mobilePrefix,
        },
      });

      if (duplicateMobile) {
        throw new ConflictException('Mobile already registered');
      }
    }

    /*
  |--------------------------------------------------------------------------
  | ORDER NUMBER
  |--------------------------------------------------------------------------
  */

    const orderNumber = `ORD-${Date.now()}`;

    /*
  |--------------------------------------------------------------------------
  | CREATE RAZORPAY ORDER
  |--------------------------------------------------------------------------
  */

    const razorpayOrder = await this.razorpayService
      .getInstance()
      .orders.create({
        amount: Math.round(Number(course.discountedPrice) * 100),
        currency: 'INR',
        receipt: orderNumber,
      });

    /*
  |--------------------------------------------------------------------------
  | HASH PASSWORD ONLY FOR NEW USER
  |--------------------------------------------------------------------------
  */

    let hashedPassword: string | null = null;

    if (!existingUser) {
      hashedPassword = await bcrypt.hash(dto.password, 10);
    }

    /*
  |--------------------------------------------------------------------------
  | SAVE PENDING REGISTRATION
  |--------------------------------------------------------------------------
  */

    await this.prisma.pendingRegistration.create({
      data: {
        userId: existingUser?.id ?? null,

        orderNumber,

        razorpayOrderId: razorpayOrder.id,

        courseId: dto.courseId,

        fullName: dto.fullName,

        email: dto.email,

        mobilePrefix: dto.mobilePrefix,

        mobile: dto.mobileNumber,

        password: hashedPassword,

        classGrade: dto.classGrade,

        schoolName: dto.schoolName,

        city: dto.city,

        amount: Number(course.discountedPrice),

        paymentStatus: 'pending',
      },
    });

    /*
  |--------------------------------------------------------------------------
  | RESPONSE
  |--------------------------------------------------------------------------
  */

    return {
      status: true,

      data: {
        order_number: orderNumber,

        razorpay_order_id: razorpayOrder.id,

        amount: razorpayOrder.amount,

        currency: razorpayOrder.currency,

        key: process.env.RAZORPAY_KEY_ID,

        prefill: {
          name: dto.fullName,
          email: dto.email,
          contact: `${dto.mobilePrefix}${dto.mobileNumber}`,
        },
      },
    };
  }

  async verifyPayment(dto: VerifyPublicPaymentDto) {
    /*
  |--------------------------------------------------------------------------
  | VERIFY SIGNATURE
  |--------------------------------------------------------------------------
  */

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(dto.razorpay_order_id + '|' + dto.razorpay_payment_id)
      .digest('hex');

    if (generatedSignature !== dto.razorpay_signature) {
      throw new BadRequestException('Payment verification failed');
    }

    /*
  |--------------------------------------------------------------------------
  | FIND PENDING REGISTRATION
  |--------------------------------------------------------------------------
  */

    const pending = await this.prisma.pendingRegistration.findFirst({
      where: {
        razorpayOrderId: dto.razorpay_order_id,
      },
    });

    if (!pending) {
      throw new NotFoundException('Registration not found');
    }

    /*
  |--------------------------------------------------------------------------
  | ALREADY COMPLETED
  |--------------------------------------------------------------------------
  */

    if (pending.paymentStatus === 'paid') {
      throw new BadRequestException('Payment already verified');
    }

    /*
|--------------------------------------------------------------------------
| GET OR CREATE USER
|--------------------------------------------------------------------------
*/

    let user;

    if (pending.userId) {
      user = await this.prisma.user.findUnique({
        where: {
          id: pending.userId,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }
    } else {
      const alreadyExists = await this.prisma.user.findFirst({
        where: {
          OR: [
            {
              email: pending.email,
            },
            {
              mobile: pending.mobile,
              mobile_prefix: pending.mobilePrefix,
            },
          ],
        },
      });

      if (alreadyExists) {
        user = alreadyExists;
      } else {
        user = await this.prisma.user.create({
          data: {
            name: pending.fullName,
            email: pending.email,
            mobile: pending.mobile,
            mobile_prefix: pending.mobilePrefix,
            password: pending.password!,
            classGrade: pending.classGrade,
            schoolName: pending.schoolName,
            status: true,
          },
        });
      }

      await this.prisma.pendingRegistration.update({
        where: {
          id: pending.id,
        },
        data: {
          userId: user.id,
        },
      });
    }

    /*
|--------------------------------------------------------------------------
| CHECK PAYMENT
|--------------------------------------------------------------------------
*/

    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        razorPayPaymentId: dto.razorpay_payment_id,
      },
    });

    if (existingPayment) {
      throw new BadRequestException('Payment already processed');
    }

    /*
|--------------------------------------------------------------------------
| CREATE PAYMENT
|--------------------------------------------------------------------------
*/

    const existingEnrollment = await this.prisma.userEnrolledCourse.findFirst({
      where: {
        userId: user.id,
        courseId: pending.courseId,
      },
    });

    if (existingEnrollment) {
      throw new BadRequestException('You are already enrolled in this course');
    }
    const { payment, enrollment } = await this.prisma.$transaction(
      async (tx) => {
        const payment = await tx.payment.create({
          data: {
            userId: user.id,

            courseId: pending.courseId,

            amount: pending.amount,

            currency: 'INR',

            status: 'paid',

            paymentDate: new Date(),

            paymentVerifiedAt: new Date(),

            razorPayOrderId: dto.razorpay_order_id,

            razorPayPaymentId: dto.razorpay_payment_id,

            paymentReference: pending.orderNumber,

            paymentMetaData: {
              razorpaySignature: dto.razorpay_signature,
            },
          },
        });

        const enrollment = await tx.userEnrolledCourse.create({
          data: {
            userId: user.id,
            paymentId: payment.id,
            courseId: pending.courseId,
          },
        });

        await tx.pendingRegistration.update({
          where: {
            id: pending.id,
          },
          data: {
            paymentStatus: 'paid',

            completedAt: new Date(),
          },
        });
        return {
          payment,
          enrollment,
        };
      },
    );
    try {
      await this.activityLogService.logActivity(
        user.id,
        'Payment Success',
        pending.courseId,
        {
          paymentId: payment.id,
        },
      );

      await this.activityLogService.logActivity(
        user.id,
        'Course Enrolled',
        pending.courseId,
      );
    } catch (err) {
      console.error(err);
    }

    /*
|--------------------------------------------------------------------------
| GENERATE JWT
|--------------------------------------------------------------------------
*/

    const token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      mobileNumber: user.mobile,
    });

    /*
|--------------------------------------------------------------------------
| RESPONSE
|--------------------------------------------------------------------------
*/

    return {
      status: true,

      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          mobile: `${user.mobile_prefix}${user.mobile}`,
        },

        token,

        enrollment: {
          course_id: pending.courseId,
          enrolled_at: enrollment.createdAt,
          access_expires_at: null,
        },
      },
    };
  }
}
