import { IsString, IsNotEmpty, Length, IsNumber, IsArray, IsOptional } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 255)
  name!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsArray()
  @IsNumber({}, { each: true })
  courseIds?: number[];

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}
