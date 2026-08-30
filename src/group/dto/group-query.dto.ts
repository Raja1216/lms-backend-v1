import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional } from 'class-validator';
import { GroupType } from 'src/generated/prisma/client';
import { PaginationDto } from 'src/shared/dto/pagination-dto';

export class GroupQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(GroupType)
  type?: GroupType;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  status?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  institutionId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ownerInstitutionId?: number;
}
