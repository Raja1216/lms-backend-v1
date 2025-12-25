import { IsString, IsNotEmpty, Length, IsNumber } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 255)
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber({}, { each: true })
  courseIds: number[];
}
