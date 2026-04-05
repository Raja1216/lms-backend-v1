import {
  IsOptional,
  IsString,
  IsArray,
  IsNumber,
  IsBase64,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateDiscussionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsNumber()
  lessonId?: number;

  @IsOptional()
  @IsNumber()
  subjectId?: number;

  @IsOptional()
  @IsNumber()
  chapterId?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}

export class AttachmentDto {
  @IsString()
  fileBase64!: string;
}
