import { IsString, IsNotEmpty } from "class-validator";
export class AddSkillDto {
  @IsNotEmpty()
  @IsString()
  skill: string;
}