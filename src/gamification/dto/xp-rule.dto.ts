import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { XpType, XpRepeatPolicy } from '../../generated/prisma/client';

export class CreateXpRuleDto {
  @IsString()
  @IsNotEmpty()
  ruleName: string;

  @IsString()
  @IsNotEmpty()
  eventKey: string;

  @IsEnum(XpType)
  @IsNotEmpty()
  xpType: XpType;

  @IsInt()
  @Min(1)
  xpAmount: number;

  @IsEnum(XpRepeatPolicy)
  @IsOptional()
  repeatPolicy?: XpRepeatPolicy;

  @IsInt()
  @IsOptional()
  dailyCap?: number;

  @IsInt()
  @IsOptional()
  courseScopeId?: number;

  @IsInt()
  @IsOptional()
  institutionScope?: number;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}

export class UpdateXpRuleDto {
  @IsString()
  @IsOptional()
  ruleName?: string;

  @IsEnum(XpType)
  @IsOptional()
  xpType?: XpType;

  @IsInt()
  @Min(1)
  @IsOptional()
  xpAmount?: number;

  @IsEnum(XpRepeatPolicy)
  @IsOptional()
  repeatPolicy?: XpRepeatPolicy;

  @IsInt()
  @IsOptional()
  dailyCap?: number;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}
