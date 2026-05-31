import { Controller, Query, Get, UseGuards, Res, Next } from '@nestjs/common';
import { QuizAttemptService } from './quiz-attempt.service';
import { PermissionGuard } from 'src/guard/permission.guard';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { Permissions } from 'src/guard/premission.decorator';
import { QuizAttemptsFilterDto } from './dto/quiz-attempts-filter.dto';
import { Response, NextFunction } from 'express';
import { successResponse } from 'src/utils/success-response';
import { ErrorHandler } from 'src/utils/error-handler';
import { createPagedResponse } from 'src/shared/create-paged-response';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('quiz-attempts')
export class QuizAttemptController {
  constructor(private readonly quizAttemptService: QuizAttemptService) {}

  @Permissions('quiz-attempt-read')
  @Get('list')
  async findAll(
    @Query() dto: QuizAttemptsFilterDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { rows, page, limit, total } =
        await this.quizAttemptService.findAll(dto);
      const result = createPagedResponse(rows, page, limit, total);
      return successResponse(
        res,
        200,
        'Quiz attempts fetched successfully',
        result,
        null,
      );
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ?? 500,
        ),
      );
    }
  }
  @Permissions('quiz-attempt-read')
  @Get('export')
  async export(
    @Query() dto: QuizAttemptsFilterDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const format = (dto.format ?? 'xlsx') as 'xlsx' | 'csv';

      if (format === 'csv') {
        const csv = await this.quizAttemptService.exportAttempts(dto, 'csv');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="quiz-attempts.csv"',
        );
        return res.send(csv);
      }

      const buffer = await this.quizAttemptService.exportAttempts(dto, 'xlsx');
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="quiz-attempts.xlsx"',
      );
      return res.send(buffer);
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ?? 500,
        ),
      );
    }
  }
}
