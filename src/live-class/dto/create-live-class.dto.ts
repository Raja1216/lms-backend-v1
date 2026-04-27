import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsDateString } from 'class-validator';

export class CreateLiveClassDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  description?: string;

  @ApiProperty()
  @IsInt()
  courseId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  subjectId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  chapterId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  moduleId?: number;

  @ApiProperty()
  @IsDateString()
  scheduledAt: string;

  @ApiProperty()
  @IsInt()
  duration: number;
}