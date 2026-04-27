import {
  IsInt,
  IsPositive,
  IsArray,
  ArrayMinSize,
  ArrayUnique,
} from 'class-validator';

export class AssignTeacherToCourseDto {
  @IsInt()
  @IsPositive()
  courseId!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  teacherIds!: number[];
}
