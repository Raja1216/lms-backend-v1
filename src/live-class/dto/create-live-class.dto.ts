import { IsString, IsOptional, IsDateString, IsInt } from 'class-validator';

export class CreateLiveClassDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  courseId: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  chapterId?: string;

  @IsDateString()
  scheduledAt: string;

  @IsInt()
  duration: number;
}