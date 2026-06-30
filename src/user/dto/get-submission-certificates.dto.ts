import { IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from 'src/shared/dto/pagination-dto';

export class GetSubmissionCertificatesDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'quizAttemptId must be an integer' })
  quizAttemptId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'quizId must be an integer' })
  quizId?: number;
}
