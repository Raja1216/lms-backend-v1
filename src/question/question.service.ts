import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { QuestionType } from 'src/generated/prisma/enums';

@Injectable()
export class QuestionService {
  constructor(private prisma: PrismaService) {}
async create(createQuestionDto: CreateQuestionDto) {
    const { quizId, questions } = createQuestionDto;

    const result = await this.prisma.$transaction(
      questions.map((q) =>
        this.prisma.question.create({
          data: {
            quizId,
            question: q.questionText,
            marks: q.marks,
            type: q.type,
            answer:
              q.type === QuestionType.MCQ || q.type === QuestionType.TRUEORFALSE
                ? null
                : q.answer,

            options:
              q.type === QuestionType.MCQ || q.type === QuestionType.TRUEORFALSE
                ? {
                    create: q.options?.map((opt) => ({
                      option: opt.option,
                      isCorrect: opt.isCorrect ?? false,
                    })),
                  }
                : undefined,
          },
          include: {
            options: true,
          },
        }),
      ),
    );
    await this.updateQuizMarks(quizId);
    return result;
  }





  findAll() {
    return `This action returns all question`;
  }

  async findOne(id: number) {
    return await this.prisma.question.findUnique({
      where: { id },
      include: {
        options: {
          select: {
            option: true,
          },
        },
        quiz: true,
      },
    });
  }

   async update(id: number, updateQuestionDto: UpdateQuestionDto) {
    const existinQuestion = await this.findOne(id);
    if (!existinQuestion) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }
    const { questionText, type, marks, options, answer } = updateQuestionDto;
    const updatedQuestion = await this.prisma.question.update({
      where: { id },
      data: {
        question: questionText,
        type,
        marks,
        answer,
        options: options
          ? {
              deleteMany: {},
              create: options.map((opt) => ({
                option: opt.option,
                isCorrect: opt.isCorrect ?? false,
              })),
            }
          : undefined,
      },
      include: {
        options: true,
      },
    });
    await this.updateQuizMarks(updatedQuestion.quizId);
    return updatedQuestion;
  }

  async updateStatus(id: number) {
    const existingQuestion = await this.findOne(id);
    if (!existingQuestion) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }
    const updatedQuestion = await this.prisma.question.update({
      where: { id },
      data: {
        status: !existingQuestion.status,
      },
    });
    await this.updateQuizMarks(existingQuestion.quizId);
    return updatedQuestion;
  }

  remove(id: number) {
    return `This action removes a #${id} question`;
  }
  private async updateQuizMarks(quizId: number): Promise<void> {
    // Sum marks of all active questions for this quiz
    const aggregate = await this.prisma.question.aggregate({
      where: {
        quizId,
        status: true,
      },
      _sum: {
        marks: true,
      },
    });

    const totalMarks = aggregate._sum.marks ?? 0;
    const passMarks = Math.ceil(totalMarks * 0.4); // 40%

    await this.prisma.quiz.update({
      where: { id: quizId },
      data: {
        totalMarks,
        passMarks,
      },
    });
  }
}
