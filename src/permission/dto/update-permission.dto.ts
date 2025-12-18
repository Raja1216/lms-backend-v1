import { IsString } from 'class-validator';

export class UpdatePermissionDto {
  @IsString()
  display_name: string;

  @IsString()
  description: string;
}