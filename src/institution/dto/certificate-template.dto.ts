import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export enum CertificateTemplateType {
  COURSE = 'course',
  QUIZ = 'quiz',
  PROJECT = 'project',
  ALL = 'all',
}

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
    certificateId?: string;
    schoolName?: string;
    className?: string;
    grade?: string;
    marks?: string;
    institutionName?: string;
  };
}

export class AssignCourseTemplateDto {
  @IsNumber()
  courseId: number;

  @IsOptional()
  @IsNumber()
  templateId?: number | null;
}
