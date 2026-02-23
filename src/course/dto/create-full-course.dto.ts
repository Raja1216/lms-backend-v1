import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { QuizPayloadDto } from 'src/quiz/dto/quiz-payload.dto';

class ContentDto {
  @IsString() title: string;
  @IsString() type: string;
  @IsOptional() videoUrl?: string;
  @IsOptional() docUrl?: string;
  @IsOptional() description?: string;
  @IsOptional() duration?: string;
  @IsOptional() noOfXpPoints?: number;
  @IsOptional()
  quiz?: QuizPayloadDto;
}

class ChapterDto {
  @IsString() title: string;
  @IsOptional() @IsArray() contents?: ContentDto[];
  @IsOptional()
  quiz?: QuizPayloadDto;
}

class ModuleDto {
  @IsString() title: string;
  @IsOptional() @IsArray() chapters?: ChapterDto[];
  @IsOptional()
  quiz?: QuizPayloadDto;
}

class SubjectDto {
  @IsString() title: string;
  @IsOptional() description?: string;
  @IsBoolean() hasModules: boolean;
  @IsOptional() @IsArray() modules?: ModuleDto[];
  @IsOptional() @IsArray() chapters?: ChapterDto[];
  @IsOptional()
  quiz?: QuizPayloadDto;
}

export class CreateFullCourseDto {
  @IsString() title: string;
  @IsString() description: string;
  @IsString() grade: string;
  @IsNumber() price: number;
  @IsNumber() discountedPrice: number;
  @IsString() thumbnail: string;
  @IsString() duration: string;
  @IsArray() teacherIds: number[];
  @IsArray() subjects: SubjectDto[];

  @IsOptional()
  quiz?: QuizPayloadDto;
}
