import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { BadgeCategory } from '../../generated/prisma/client';

export class CreateBadgeDto {
  @IsEnum(BadgeCategory)
  type: BadgeCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  shortDescription?: string | null;

  @IsOptional()
  @IsString()
  description: string | null;

  @IsUrl({ require_tld: false })
  imageUrl: string;

  @IsOptional()
  @IsString()
  background?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  trigger: string;

  @IsString()
  @IsNotEmpty()
  targetScope: string;

  @ValidateIf((o) => o.targetId !== null && o.targetId !== undefined)
  @IsString()
  targetId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  targetLabel?: string | null;

  @IsOptional()
  @IsObject()
  targetPath?: Record<string, unknown> | null;

  @ValidateIf((o) => o.threshold !== null && o.threshold !== undefined)
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