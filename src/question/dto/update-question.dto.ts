import {
  IsString,
  IsEnum,
  IsInt,
  IsOptional,
  IsBoolean,
  Min,
  Max,
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
} from 'class-validator';
import { QuestionType } from 'src/generated/prisma/enums';
import { Type } from 'class-transformer';

export class UpdateQuestionDto {
  @IsString()
  questionText: string;

  @IsEnum(QuestionType)
  type: QuestionType;

  @IsInt()
  @Min(1)
  @Max(100)
  marks: number;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionOptionDto)
  options?: CreateQuestionOptionDto[];

  // SHORT_ANSWER
  @IsOptional()
  @IsString()
  answer?: string;
}

export class CreateQuestionOptionDto {
  @IsString()
  option: string;

  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean;
}
