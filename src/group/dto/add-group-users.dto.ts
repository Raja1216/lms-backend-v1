import { ArrayNotEmpty, ArrayUnique, IsArray, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class AddGroupUsersDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  userIds: number[];
}
