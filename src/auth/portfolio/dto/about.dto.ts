import { IsString, IsNotEmpty } from "class-validator";
export class AddAboutDto {
  @IsNotEmpty()
  @IsString()
  about: string;
}