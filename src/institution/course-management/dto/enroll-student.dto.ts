import {
  IsInt,
  IsPositive,
  IsArray,
  ArrayMinSize,
  ArrayUnique,
} from 'class-validator';

export class EnrollStudentDto {
  @IsInt()
  @IsPositive()
  courseId!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  studentIds!: number[];
}
