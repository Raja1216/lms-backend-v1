import { IsString, IsOptional, IsInt } from 'class-validator';

export class QuizPayloadDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsInt()
  timeLimit?: number;

  @IsOptional()
  @IsInt()
  passMarks?: number;
}
