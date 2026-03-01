import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  Length,
  IsUrl,
} from 'class-validator';
import { LessonType } from 'src/generated/prisma/enums';
import { IsBase64 } from 'class-validator';
export class CreateLessonDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 255)
  title: string;

  @IsString()
  topicName: string;

  @IsString()
  @IsOptional()
  description: string;

  @IsEnum(LessonType)
  lessonType: LessonType;

  @IsOptional()
  @IsNumber({}, { each: true })
  chapterIds?: number[];

  @IsUrl()
  @IsOptional()
  videoUrl?: string;

  @IsUrl()
  @IsOptional()
  documentContent?: string;

  @IsOptional()
  @IsNumber()
  NumberOfPages?: number;

  @IsOptional()
  @IsNumber()
  noOfXpPoints?: number;
}
