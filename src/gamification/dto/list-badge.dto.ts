import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../shared/dto/pagination-dto';

export class ListBadgeDto extends PaginationDto {
  /**
   * Filter by badge category or high-level group ("LEARNING", "ENGAGEMENT", or specific BadgeCategory)
   */
  @IsOptional()
  @IsString()
  type?: string;

  /**
   * Backward-compatibility alias for `keyword` search
   */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;
}
