import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { GradingMethod, SubmissionType } from '../../generated/prisma/enums';
 
export class CreateRubricDto {
  @ApiProperty({ example: 'Design Quality' })
  @IsString()
  @IsNotEmpty()
  title: string;
 
  @ApiPropertyOptional({ example: 'Evaluate UI/UX design' })
  @IsOptional()
  @IsString()
  description?: string;
 
  @ApiProperty({ example: 30, description: 'Weight % (all rubrics must sum to 100)' })
  @IsNumber()
  @Min(1)
  @Max(100)
  weight: number;
 
  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(1)
  maxMarks: number;
}
 
export class CreateProjectDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  courseId: number;
 
  @ApiProperty({ example: 'Final Portfolio Project' })
  @IsString()
  @IsNotEmpty()
  title: string;
 
  @ApiProperty({ example: 'Build a full-stack app and submit your code + docs.' })
  @IsString()
  @IsNotEmpty()
  description: string;
 
  @ApiProperty({ enum: SubmissionType, example: SubmissionType.pdf })
  @IsEnum(SubmissionType)
  submissionType: SubmissionType;
 
  @ApiProperty({ example: '2025-12-31T23:59:00.000Z' })
  @IsDateString()
  deadline: string;
 
  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(1)
  maxMarks: number;
 
  @ApiProperty({ enum: GradingMethod, example: GradingMethod.manual })
  @IsEnum(GradingMethod)
  gradingMethod: GradingMethod;
 
  @ApiPropertyOptional({ example: 30, description: 'Contribution % to final course score' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weightPercent?: number;
 
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  allowLate?: boolean;
 
  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  maxFileSizeMb?: number;
 
  @ApiPropertyOptional({ type: [CreateRubricDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRubricDto)
  rubrics?: CreateRubricDto[];
}