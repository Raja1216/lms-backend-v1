import { IsInt, IsOptional } from 'class-validator';

import { Type } from 'class-transformer';
import { PaginationDto } from 'src/shared/dto/pagination-dto';

export class CourseQueryDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;
}
