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
  Query,
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
@Controller('questions') // ✅ plural (recommended)
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
        throw new NotFoundException('Quiz not found');
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
          error.status || 500,
        ),
      );
    }
  }

  // ✅ FIXED: real implementation with pagination
  @Get()
  async findAll(
    @Query() query: any,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.questionService.findAll(query);
      return successResponse(
        res,
        200,
        'Questions fetched successfully',
        result,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status || 500,
        ),
      );
    }
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
        'Question fetched successfully',
        question,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status || 500,
        ),
      );
    }
  }

  @Permissions('update-question')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateQuestionDto: UpdateQuestionDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.questionService.update(+id, updateQuestionDto);
      return successResponse(
        res,
        200,
        'Question updated successfully',
        result,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status || 500,
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
        'Question status updated successfully',
        updatedQuestion,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status || 500,
        ),
      );
    }
  }

  // ✅ FIXED: soft delete
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const result = await this.questionService.remove(+id);
      return successResponse(
        res,
        200,
        'Question deleted successfully',
        result,
        null,
      );
    } catch (error) {
      return next(
        new ErrorHandler(
          error instanceof Error ? error.message : 'Internal Server Error',
          error.status || 500,
        ),
      );
    }
  }

  // ✅ Stub for future Excel upload
  @Post('bulk-upload')
  async bulkUpload(@Res() res: Response) {
    return successResponse(
      res,
      200,
      'Bulk upload endpoint ready',
      [],
      null,
    );
  }
}
