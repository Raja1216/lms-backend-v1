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
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { QuestionService } from './question.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { Response, NextFunction } from 'express';
import { successResponse } from 'src/utils/success-response';
import { ErrorHandler } from 'src/utils/error-handler';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { PermissionGuard } from 'src/guard/permission.guard';
import { Permissions } from 'src/guard/premission.decorator';
import { QuizService } from 'src/quiz/quiz.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('question')
export class QuestionController {
  constructor(
    private readonly questionService: QuestionService,
    private readonly quizService: QuizService,
  ) {}

  @Permissions('create-question')
  @Post()
  async create(
    @Body() createQuestionDto: CreateQuestionDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const { quizId } = createQuestionDto;
      const quiz = await this.quizService.findOne(quizId);
      if (!quiz) {
        throw new NotFoundException(`Quiz not found`);
      }
      const question = await this.questionService.create(createQuestionDto);
      return successResponse(
        res,
        201,
        'Question created successfully',
        question,
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

  @Get()
  findAll() {
    return this.questionService.findAll();
  }

  @Permissions('read-question')
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const question = await this.questionService.findOne(+id);
      return successResponse(
        res,
        200,
        'question updated Successfully',
        question,
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

  @Permissions('update-question')
  @Patch('status/:id')
  async updateStatus(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const updatedQuestion = await this.questionService.updateStatus(+id);
      return successResponse(
        res,
        200,
        'Question status updated Successfully',
        updatedQuestion,
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
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateQuestionDto: UpdateQuestionDto,
  ) {
    return this.questionService.update(+id, updateQuestionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.questionService.remove(+id);
  }
}
