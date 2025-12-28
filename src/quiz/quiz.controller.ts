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

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.quizService.remove(+id);
  }
}
