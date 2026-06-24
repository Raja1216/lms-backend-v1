import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/shared/dto/pagination-dto';

export class AdminActivityQueryDto extends PaginationDto {
  @IsOptional()
  @IsString({ message: 'startDate must be a string' })
  startDate?: string;

  @IsOptional()
  @IsString({ message: 'endDate must be a string' })
  endDate?: string;

  @IsOptional()
  @IsString({ message: 'statKey must be a string' })
  statKey?: string;

  @IsOptional()
  @IsString({ message: 'category must be a string' })
  category?: string;
}
