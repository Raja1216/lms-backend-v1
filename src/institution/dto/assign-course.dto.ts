import { IsInt, IsPositive, IsOptional, Min } from 'class-validator';

export class AssignCourseDto {
  @IsInt()
  @IsPositive()
  courseId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  seats?: number;
}
