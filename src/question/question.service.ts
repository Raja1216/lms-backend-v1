import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { QuestionType } from 'src/generated/prisma/enums';

@Injectable()
export class QuestionService {
  constructor(private prisma: PrismaService) {}

  async create(createQuestionDto: CreateQuestionDto) {
    const { quizId, questions } = createQuestionDto;

    // ✅ Validation for TRUE/FALSE
    for (const q of questions) {
      if (q.type === QuestionType.TRUEORFALSE) {
        if (!q.options || q.options.length !== 2) {
          throw new BadRequestException(
            'TRUE/FALSE questions must have exactly 2 options',
          );
        }
      }
    }

    const result = await this.prisma.$transaction(
      questions.map((q) =>
        this.prisma.question.create({
          data: {
            quizId,
            question: q.questionText,
            marks: q.marks,
            type: q.type,
            answer:
              q.type === QuestionType.MCQ ||
              q.type === QuestionType.TRUEORFALSE
                ? null
                : q.answer,
            duration: q.duration,
            options:
              q.type === QuestionType.MCQ ||
              q.type === QuestionType.TRUEORFALSE
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

  // ✅ FIXED
  async findAll(query: any) {
    const { quizId, page = 1, limit = 20 } = query;

    return this.prisma.question.findMany({
      where: {
        quizId: quizId ? +quizId : undefined,
        status: true,
      },
      include: {
        options: true,
        quiz: true,
      },
      skip: (page - 1) * limit,
      take: +limit,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: {
        options: true,
        quiz: true,
      },
    });

    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }

    return question;
  }

  async update(id: number, updateQuestionDto: UpdateQuestionDto) {
    const existing = await this.findOne(id);

    const { questionText, type, marks, options, answer, duration } =
      updateQuestionDto;

    const updatedQuestion = await this.prisma.question.update({
      where: { id },
      data: {
        question: questionText,
        type,
        marks,
        answer,
        duration,
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

    await this.updateQuizMarks(existing.quizId);
    return updatedQuestion;
  }

  async updateStatus(id: number) {
    const existing = await this.findOne(id);

    const updated = await this.prisma.question.update({
      where: { id },
      data: { status: !existing.status },
    });

    await this.updateQuizMarks(existing.quizId);
    return updated;
  }

  // ✅ FIXED: real soft delete
  async remove(id: number) {
    const existing = await this.findOne(id);

    const updated = await this.prisma.question.update({
      where: { id },
      data: { status: false },
    });

    await this.updateQuizMarks(existing.quizId);
    return updated;
  }

  private async updateQuizMarks(quizId: number): Promise<void> {
    const aggregate = await this.prisma.question.aggregate({
      where: { quizId, status: true },
      _sum: { marks: true, duration: true },
    });

    const totalMarks = aggregate._sum.marks ?? 0;
    const passMarks = Math.ceil(totalMarks * 0.4);

    await this.prisma.quiz.update({
      where: { id: quizId },
      data: {
        totalMarks,
        passMarks,
        timeLimit: aggregate._sum.duration ?? 0,
      },
    });
  }
}
