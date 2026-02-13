import { IsInt, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateModuleDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 255)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  subjectId: number;
}
