import { IsString, IsOptional, IsInt, IsEnum, IsNotEmpty } from 'class-validator';
import { QuizSubmissionFrequency } from 'src/generated/prisma/enums';
export class CreateQuizDto {
  @IsString()
  title!: string;

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

  @IsEnum(QuizSubmissionFrequency)
  @IsNotEmpty()
  submissionFrequency!: QuizSubmissionFrequency;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

