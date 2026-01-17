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
  ConflictException,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { QuizService } from './quiz.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { Response, NextFunction } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { PermissionGuard } from 'src/guard/permission.guard';
import { Permissions } from 'src/guard/premission.decorator';
import { successResponse } from 'src/utils/success-response';
import { ErrorHandler } from 'src/utils/error-handler';
import { LessonService } from 'src/lesson/lesson.service';
import { SubmitQuizDto } from './dto/submit-quiz.dto';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('quiz')
export class QuizController {
  constructor(
    private readonly quizService: QuizService,
    private readonly lessonServive: LessonService,
  ) {}

  @Permissions('create-quiz')
  @Post()
  async create(
    @Body() createQuizDto: CreateQuizDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { title, lessonIds } = createQuizDto;
      const quizExists = await this.quizService.findQuizByTitle(title);
      if (quizExists) {
        throw new ConflictException('Quiz with this title already exists');
      }

      // Validate lesson IDs
      for (const lessonId of lessonIds) {
        const lessonExists = await this.lessonServive.findOne(lessonId);
        if (!lessonExists) {
          throw new ConflictException(
            `Lesson with ID ${lessonId} does not exist`,
          );
        }
      }
      const quiz = await this.quizService.create(createQuizDto);
      return successResponse(res, 201, 'Quiz created successfully', quiz, null);
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @Get()
  findAll() {
    return this.quizService.findAll();
  }

  @Permissions('read-quiz')
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const quiz = await this.quizService.findOne(+id);
      return successResponse(res, 200, 'Quiz fetched successfully', quiz, null);
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @Get('slug/:slug')
  async findBySlug(
    @Param('slug') slug: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const quiz = await this.quizService.findBySlug(slug);
      return successResponse(res, 200, 'Quiz fetched successfully', quiz, null);
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @Permissions('update-quiz')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateQuizDto: UpdateQuizDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { title, lessonIds } = updateQuizDto;
      if (title) {
        const quizExists = await this.quizService.findQuizByTitle(title, +id);
        if (quizExists) {
          throw new ConflictException('Quiz with this title already exists');
        }
      }
      if (lessonIds && lessonIds.length > 0) {
        for (const lessonId of lessonIds) {
          const lessonExists = await this.lessonServive.findOne(lessonId);
          if (!lessonExists) {
            throw new ConflictException(
              `Lesson with ID ${lessonId} does not exist`,
            );
          }
        }
      }
      const updatedQuiz = await this.quizService.update(+id, updateQuizDto);
      return successResponse(
        res,
        200,
        'Quiz updated successfully',
        updatedQuiz,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @Permissions('update-quiz')
  @Patch('status/:id')
  async updateStatus(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const updatedQuiz = await this.quizService.updateStatus(+id);
      return successResponse(
        res,
        200,
        'Quiz status updated successfully',
        updatedQuiz,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @Post(':quizId/submit')
  async submitQuiz(
    @Param('quizId', ParseIntPipe) quizId: number,
    @Body() submitQuizDto: SubmitQuizDto,
    @Request() req,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const userId = req.user.id;

      const result = await this.quizService.submitQuiz(
        userId,
        quizId,
        submitQuizDto,
      );

      return successResponse(
        res,
        200,
        'Quiz submitted successfully',
        result,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @Get(':quizId/attempts')
  async getQuizAttempts(
    @Param('quizId', ParseIntPipe) quizId: number,
    @Request() req,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const userId = req.user.id;
      const attempts = await this.quizService.getQuizAttempts(userId, quizId);

      return successResponse(
        res,
        200,
        'Quiz attempts retrieved successfully',
        attempts,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @Get('attempt/:attemptId')
  async getAttemptDetails(
    @Param('attemptId', ParseIntPipe) attemptId: number,
    @Request() req,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const userId = req.user.id;
      const attempt = await this.quizService.getAttemptDetails(
        attemptId,
        userId,
      );

      return successResponse(
        res,
        200,
        'Attempt details retrieved successfully',
        attempt,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status ? error.status : 500,
        ),
      );
    }
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.quizService.remove(+id);
  }
}
