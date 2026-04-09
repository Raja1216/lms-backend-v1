import { IsOptional, IsString } from 'class-validator';

export class GetReportDto {
  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  chapterId?: string;
}