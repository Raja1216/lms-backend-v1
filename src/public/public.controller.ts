import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PublicService } from './public.service';
import { PublicCheckoutDto } from './dto/public-checkout.dto';
import { VerifyPublicPaymentDto } from './dto/verify-public-payment.dto';

@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  /*
  |--------------------------------------------------------------------------
  | FEATURED COURSES
  |--------------------------------------------------------------------------
  */

  @Get('courses/featured')
  async getFeaturedCourses(@Query('limit') limit = 6) {
    return this.publicService.getFeaturedCourses(Number(limit));
  }

  @Get('courses/:slug')
  async getCourseDetails(@Param('slug') slug: string) {
    return this.publicService.getCourseDetails(slug);
  }

  @Post('enrollment/checkout')
  async checkout(@Body() dto: PublicCheckoutDto) {
    return this.publicService.checkout(dto);
  }

  @Post('enrollment/verify-payment')
  async verifyPayment(@Body() dto: VerifyPublicPaymentDto) {
    return this.publicService.verifyPayment(dto);
  }
}
