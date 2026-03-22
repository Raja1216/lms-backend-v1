import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ManualGradeDto {
  @ApiProperty({ example: 85, description: 'Marks obtained by student' })
  @IsNumber()
  @Min(0)
  obtainedMarks: number;

  @ApiPropertyOptional({
    example: 'Good effort. Documentation could be improved.',
  })
  @IsOptional()
  @IsString()
  feedback?: string;
}

export class RubricCriterionGradeDto {
  @ApiProperty({ example: 1, description: 'ProjectRubric id' })
  @IsInt()
  rubricId: number;

  @ApiProperty({ example: 25 })
  @IsNumber()
  @Min(0)
  marks: number;

  @ApiPropertyOptional({
    example: 'Good design but missing mobile responsiveness.',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class RubricGradeDto {
  @ApiProperty({ type: [RubricCriterionGradeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RubricCriterionGradeDto)
  criteria: RubricCriterionGradeDto[];

  @ApiPropertyOptional({ example: 'Overall good project.' })
  @IsOptional()
  @IsString()
  feedback?: string;
}

export class CoursePerformanceQueryDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Type(() => Number)
  courseId: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Type(() => Number)
  studentId: number;
}
