import { ArrayNotEmpty, ArrayUnique, IsArray, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class AddGroupInstitutionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  institutionIds: number[];
}
