import { IsString, IsNotEmpty, Length, IsNumber } from 'class-validator';
export class CreateChapterDto {

    @IsString()
    @Length(3, 255)
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    description: string;

    @IsNumber({}, { each: true })
    @IsNotEmpty()
    subjectIds: number[];
}
