import { IsString, IsNotEmpty, IsNumber } from 'class-validator';
export class CreateQuizDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @IsNotEmpty()
  duration: number; // duration in seconds

  @IsNumber({}, { each: true })
  lessonIds: number[];
}
