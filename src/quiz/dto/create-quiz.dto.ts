import { IsInt, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class CreateQuizDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Attach quiz to ONE level only
  @IsOptional()
  @IsInt()
  courseId?: number;

  @IsOptional()
  @IsInt()
  subjectId?: number;

  @IsOptional()
  @IsInt()
  moduleId?: number;

  @IsOptional()
  @IsInt()
  chapterId?: number;

  @IsOptional()
  @IsInt()
  lessonId?: number;
}
