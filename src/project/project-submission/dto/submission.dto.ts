import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination-dto';
import { SubmissionStatus, SubmissionType } from '../../../generated/prisma/enums';
 
 
export class SubmitLinkDto {
  @ApiProperty({ enum: SubmissionType, example: SubmissionType.link })
  @IsEnum(SubmissionType)
  fileType: SubmissionType;
 
  @ApiProperty({ example: 'https://github.com/student/project' })
  @IsUrl()
  fileUrl: string;
}
 
export class CreateSubmissionDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  projectId: number;
 
  @ApiPropertyOptional({ example: 'Here is my final project submission.' })
  @IsOptional()
  @IsString()
  description?: string;
 
  /** Links (GitHub, Drive, etc.) submitted as JSON body */
  @ApiPropertyOptional({ type: [SubmitLinkDto] })
  @IsOptional()
  @IsArray()
  links?: SubmitLinkDto[];
}
 
export class UpdateSubmissionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
 
  @ApiPropertyOptional({ type: [SubmitLinkDto] })
  @IsOptional()
  @IsArray()
  links?: SubmitLinkDto[];
}
 
 
export class QuerySubmissionsDto extends PaginationDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;
 
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  studentId?: number;
 
  @ApiPropertyOptional({ enum: SubmissionStatus })
  @IsOptional()
  @IsEnum(SubmissionStatus)
  status?: SubmissionStatus;
}