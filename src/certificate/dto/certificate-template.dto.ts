import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateCertificateTemplateDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  type?: string; // 'course' | 'quiz' | 'project' | 'all'

  @IsOptional()
  @IsString()
  backgroundUrl?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  secondaryLogoUrl?: string;

  @IsOptional()
  @IsString()
  signatureUrl?: string;

  @IsOptional()
  @IsString()
  signatoryName?: string;

  @IsOptional()
  @IsString()
  signatoryTitle?: string;

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  textColor?: string;

  @IsOptional()
  @IsString()
  fontFamily?: string;

  @IsOptional()
  @IsString()
  headerText?: string;

  @IsOptional()
  @IsString()
  subHeaderText?: string;

  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsOptional()
  @IsString()
  footerText?: string;

  @IsOptional()
  @IsBoolean()
  showQrCode?: boolean;

  @IsOptional()
  @IsBoolean()
  showGrade?: boolean;

  @IsOptional()
  @IsBoolean()
  showScore?: boolean;

  @IsOptional()
  @IsBoolean()
  showIssueDate?: boolean;

  @IsOptional()
  @IsBoolean()
  showCertificateId?: boolean;

  @IsOptional()
  @IsString()
  customHtml?: string;

  @IsOptional()
  @IsNumber()
  courseId?: number;

  @IsOptional()
  @IsArray()
  courseIds?: number[];

  @IsOptional()
  @IsNumber()
  quizId?: number;

  @IsOptional()
  @IsArray()
  quizIds?: number[];

  @IsOptional()
  @IsNumber()
  projectId?: number;

  @IsOptional()
  @IsArray()
  projectIds?: number[];

  @IsOptional()
  @IsNumber()
  institutionId?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  status?: boolean;
}

export class UpdateCertificateTemplateDto extends PartialType(
  CreateCertificateTemplateDto,
) {}

export class PreviewCertificateTemplateDto {
  @IsOptional()
  template?: CreateCertificateTemplateDto;

  @IsOptional()
  sampleData?: {
    studentName?: string;
    courseName?: string;
    examName?: string;
    projectName?: string;
    completionDate?: string;
    date?: string;
    certificateId?: string;
    certificateNumber?: string;
    schoolName?: string;
    className?: string;
    grade?: string;
    marks?: string;
    institutionName?: string;
  };
}

export class AssignCourseTemplateDto {
  @IsOptional()
  @IsNumber()
  courseId?: number;

  @IsOptional()
  @IsArray()
  courseIds?: number[];

  @IsOptional()
  @IsNumber()
  templateId?: number | null;
}

export class AssignQuizTemplateDto {
  @IsOptional()
  @IsNumber()
  quizId?: number;

  @IsOptional()
  @IsArray()
  quizIds?: number[];

  @IsOptional()
  @IsNumber()
  templateId?: number | null;
}

export class AssignProjectTemplateDto {
  @IsOptional()
  @IsNumber()
  projectId?: number;

  @IsOptional()
  @IsArray()
  projectIds?: number[];

  @IsOptional()
  @IsNumber()
  templateId?: number | null;
}

export class UpdateCertificateSettingsDto {
  @IsString()
  mode: 'static' | 'dynamic';
}

import { PaginationDto } from '../../shared/dto/pagination-dto';

export class CertificateTemplateQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @IsOptional()
  @IsNumber()
  courseId?: number;

  @IsOptional()
  @IsNumber()
  quizId?: number;

  @IsOptional()
  @IsNumber()
  projectId?: number;
}

