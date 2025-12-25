import { IsString, Length, IsNumber } from 'class-validator';
import { IsBase64 } from '../../custom-validator/IsBase64.validator';

export class CreateCourseDto {
  @IsString()
  @Length(5, 255)
  title: string;
  @IsString()
  description: string;
  @IsBase64({ message: 'Thumbnail must be a valid Base64 string or data URL' })
  thumbnail: string;
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
