import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { BadgeCategory, BadgeTargetScope } from '../../generated/prisma/client';

export { BadgeTargetScope };
export { BadgeTargetScope as TargetScope };

export class CreateBadgeDto {
  @Transform(
    ({
      value,
      obj,
    }: {
      value: unknown;
      obj?: Record<string, unknown>;
    }): BadgeCategory => {
      if (value === 'ENGAGEMENT') {
        const trigger =
          typeof obj?.trigger === 'string' ? obj.trigger.toUpperCase() : '';
        if (trigger.includes('STREAK')) return BadgeCategory.STREAK;
        if (trigger.includes('FORUM')) return BadgeCategory.COMMUNITY;
        return BadgeCategory.LEARNING;
      }
      return value as BadgeCategory;
    },
  )
  @IsEnum(BadgeCategory)
  type!: BadgeCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  shortDescription?: string | null;

  @IsOptional()
  @IsString()
  description!: string | null;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  background?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  trigger!: string;

  @Transform(
    ({ value }: { value: unknown }): BadgeTargetScope =>
      value === 'ANY' ? BadgeTargetScope.ALL : (value as BadgeTargetScope),
  )
  @IsEnum(BadgeTargetScope)
  targetScope!: BadgeTargetScope;

  @ValidateIf(
    (o: CreateBadgeDto) => o.targetId !== null && o.targetId !== undefined,
  )
  @IsString()
  targetId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  targetLabel?: string | null;

  @IsOptional()
  @IsObject()
  targetPath?: Record<string, unknown> | null;

  @ValidateIf(
    (o: CreateBadgeDto) => o.threshold !== null && o.threshold !== undefined,
  )
  @IsInt()
  @Min(1)
  threshold?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  xpReward?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
