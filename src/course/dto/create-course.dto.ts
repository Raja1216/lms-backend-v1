import { IsString, Length, IsNumber, IsOptional } from 'class-validator';
import { IsBase64 } from '../../custom-validator/IsBase64.validator';

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
  grade: string;
  @IsString()
  duration: string;
  @IsString()
  price: string;
  @IsString()
  discountedPrice: string;
  @IsNumber({}, { each: true })
  teacherIds: number[];
}
