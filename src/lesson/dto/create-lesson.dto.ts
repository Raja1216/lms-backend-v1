import { IsNotEmpty, IsString, IsOptional, IsNumber, IsEnum, Length } from 'class-validator';
import { LessonType } from 'src/generated/prisma/enums';
import { IsBase64 } from 'class-validator';
export class CreateLessonDto {
    @IsString()
    @IsNotEmpty()
    @Length(3, 255)
    title: string;

    @IsString()
    @IsOptional()
    description: string;
    @IsEnum(LessonType)
    lessonType: LessonType;
    
}
