import { IsEnum, IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignCatalogCourseDto {
  @Type(() => Number)
  @IsInt()
  courseId: number;

  @IsOptional()
  @IsEnum(['granted', 'purchased'], { message: 'Source must be granted or purchased' })
  source?: 'granted' | 'purchased' = 'granted';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seats?: number;
}
