import { IsEnum } from 'class-validator';

export class UpdateVisibilityDto {
  @IsEnum(['public', 'private'], { message: 'Visibility must be either public or private' })
  visibility: 'public' | 'private';
}
