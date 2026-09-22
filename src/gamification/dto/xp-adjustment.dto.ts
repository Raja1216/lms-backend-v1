import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { XpType } from '../../generated/prisma/client';

export class ManualXpAdjustmentDto {
  @IsInt()
  @IsNotEmpty()
  userId: number;

  @IsEnum(XpType)
  @IsNotEmpty()
  xpType: XpType;

  @IsInt()
  @IsNotEmpty()
  amount: number; // can be positive or negative (for reversals)

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  reference?: string;
}
