import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @Length(2, 150)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  allowInstituteManageMembers?: boolean;

  @IsOptional()
  @IsBoolean()
  status?: boolean;
}
