import { IsArray, IsEnum, IsBoolean, IsOptional } from 'class-validator';


export enum CsvEntityType {
  COURSE = 'course',
  SUBJECT = 'subject',
  CHAPTER = 'chapter',
  LESSON = 'lesson',
  QUIZ = 'quiz',
  QUESTION = 'question',
}

export class CsvUploadDto {
  @IsEnum(CsvEntityType)
  entityType: CsvEntityType;
}

export class CsvPreviewDto {
  headers: string[];
  rows: Record<string, any>[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: CsvRowError[];
}

export class CsvRowError {
  row: number;
  field?: string;
  message: string;
  data?: Record<string, any>;
}

export class CsvImportDto {
  @IsEnum(CsvEntityType)
  entityType: CsvEntityType;

  @IsArray()
  data: Record<string, any>[];

  @IsBoolean()
  @IsOptional()
  updateExisting?: boolean = false;
}

export interface CsvTemplate {
  filename: string;
  headers: string[];
  sampleData: Record<string, any>[];
  description: string;
}

export type EntityValidator = (data: Record<string, any>) => Promise<CsvRowError[]>;
export type EntityProcessor = (data: Record<string, any>[], updateExisting: boolean) => Promise<any[]>;