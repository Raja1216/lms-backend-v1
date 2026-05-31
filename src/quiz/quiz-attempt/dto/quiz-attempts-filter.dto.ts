import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
 
export class QuizAttemptsFilterDto {
  @IsOptional()
  @IsString()
  keyword?: string;
 
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;
 
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
 
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  courseId?: number;
 
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  subjectId?: number;
 
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  moduleId?: number;
 
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  chapterId?: number;
 
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  quizId?: number;
 
  @IsOptional()
  @IsString()
  grade?: string; // class grade filter (User.classGrade)
 
  @IsOptional()
  @IsString()
  format?: 'xlsx' | 'csv'; // export format
}
 