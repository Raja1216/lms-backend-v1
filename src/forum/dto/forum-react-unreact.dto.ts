import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
export class ForumReactUnreactDto {
  @IsString()
  @IsNotEmpty()
  forumId: string;
  @IsOptional()
  @IsString()
  emoji?: string;
}
