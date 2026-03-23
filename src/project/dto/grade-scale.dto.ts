import { IsArray, ValidateNested, IsNumber, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class GradeBandDto {
  @ApiProperty({
    description: 'Minimum percentage for this grade band',
    example: 90,
  })
  @IsNumber()
  minPercent: number;
  @ApiProperty({
    description: 'Maximum percentage for this grade band',
    example: 100,
  })
  @IsNumber()
  maxPercent: number;
  @ApiProperty({
    description: 'Letter grade for this band',
    example: 'A+',
  })
  @IsString()
  letterGrade: string;
}

export class UpsertGradeScaleDto {
  @ApiProperty({
    description: 'List of grade bands',
    example: [
      {
        minPercent: 90,
        maxPercent: 100,
        letterGrade: 'A+',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradeBandDto)
  bands: GradeBandDto[];
}
