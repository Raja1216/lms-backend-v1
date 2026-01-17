import { IsArray, IsNumber, IsString, ValidateNested, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class QuestionAnswerDto {
  @IsNumber()
  questionId: number;

  @IsString()
  answer: string | string[];

  @IsString()
  type: string;

  @IsOptional()
  @IsNumber()
  timeSpent?: number;
}

export class SubmitQuizDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionAnswerDto)
  answers: QuestionAnswerDto[];

  @IsOptional()
  @IsInt()
  timeTaken?: number; // Total time in seconds
}