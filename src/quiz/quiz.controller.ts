import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Res,
  Next,
  UseGuards,
  Request,
  ParseIntPipe,
  Query,
  Request as NestjsRequest,
} from '@nestjs/common';
import { QuizService } from './quiz.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { Response, NextFunction } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { PermissionGuard } from 'src/guard/permission.guard';
import { Permissions } from 'src/guard/premission.decorator';
import { successResponse } from 'src/utils/success-response';
import { ErrorHandler } from 'src/utils/error-handler';
import { User } from 'src/generated/prisma/client';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Permissions('quiz-create')
  @Post()
  async create(
    @Body() dto: CreateQuizDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const quiz = await this.quizService.create(dto);
      return successResponse(res, 201, 'Quiz created successfully', quiz, null);
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ?? 500,
        ),
      );
    }
  }

  @Get()
  async findAll(
    @Query() query: any,
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestjsRequest() req: { user: User },
  ) {
    try {
      const quizzes = await this.quizService.findAll(query, req.user.id);
      return successResponse(
        res,
        200,
        'Quizzes fetched successfully',
        quizzes,
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

  @Permissions('quiz-read')
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const quiz = await this.quizService.findOne(id);
      return successResponse(res, 200, 'Quiz fetched successfully', quiz, null);
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ?? 500,
        ),
      );
    }
  }

  @Get('slug/:slug')
  async findBySlug(
    @Param('slug') slug: string,
    @Res() res: Response,
    @Next() next: NextFunction,
    @NestjsRequest() req: { user: User },
  ) {
    try {
      const quiz = await this.quizService.findBySlug(slug, req.user.id);
      return successResponse(res, 200, 'Quiz fetched successfully', quiz, null);
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ?? 500,
        ),
      );
    }
  }

  /* ================= UPDATE ================= */

  @Permissions('quiz-update')
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateQuizDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const quiz = await this.quizService.update(id, dto);
      return successResponse(res, 200, 'Quiz updated successfully', quiz, null);
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ?? 500,
        ),
      );
    }
  }

  @Permissions('quiz-update')
  @Patch('status/:id')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const quiz = await this.quizService.updateStatus(id);
      return successResponse(
        res,
        200,
        'Quiz status updated successfully',
        quiz,
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

  @Post(':quizId/submit')
  async submit(
    @Param('quizId', ParseIntPipe) quizId: number,
    @Body() dto: SubmitQuizDto,
    @NestjsRequest() req: { user: User },
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.quizService.submitQuiz(
        req.user.id,
        quizId,
        dto,
      );
      return successResponse(res, 200, 'Quiz submitted', result, null);
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ?? 500,
        ),
      );
    }
  }

  @Permissions('quiz-delete')
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    return successResponse(
      res,
      200,
      'Quiz delete not implemented yet',
      null,
      null,
    );
  }
}
