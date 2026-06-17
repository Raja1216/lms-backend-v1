import { IsString, Length, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { IsBase64 } from '../../custom-validator/IsBase64.validator';
import { CourseAudience } from 'src/generated/prisma/enums';

export class CreateCourseDto {
  @IsString()
  @Length(5, 255)
  title: string;
  @IsString()
  description: string;
  @IsOptional()
  @IsString()
  thumbnail?: string;
  @IsString()
  grade?: string;
  @IsEnum(CourseAudience)
  audience: CourseAudience;
  @IsString()
  duration: string;
  @IsString()
  price: string;
  @IsString()
  discountedPrice: string;
  @IsNumber({}, { each: true })
  teacherIds: number[];
}
