import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { QuestionType } from 'src/generated/prisma/enums';
export class CreateQuestionDto {
  @IsNumber()
  @Min(1)
  quizId: number;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionItemDto)
  questions: CreateQuestionItemDto[];
}
export class CreateQuestionItemDto {
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

  // duration in minutes
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  duration: number;
}

export class CreateQuestionOptionDto {
  @IsString()
  option: string;

  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean;
}
