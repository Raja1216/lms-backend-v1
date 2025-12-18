import {IsInt, IsOptional, IsString, Min} from 'class-validator';
import {Type} from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @IsString({ message: 'Keyword must be a string' })
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({message: 'Page must be an integer'})
  @Min(1, {message: 'Page must be at least 1'})
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({message: 'Limit must be an integer'})
  @Min(1, {message: 'Limit must be at least 1'})
  limit?: number = 10;
}