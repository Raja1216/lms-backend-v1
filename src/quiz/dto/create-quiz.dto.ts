import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreateQuizDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsInt()
  timeLimit?: number; // seconds

  @IsOptional()
  @IsInt()
  passMarks?: number;

  @IsOptional()
  @IsInt()
  totalMarks?: number;

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

