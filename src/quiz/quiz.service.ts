import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { generateSlug } from 'src/shared/generate-slug';

@Injectable()
export class QuizService {
  constructor(private prisma: PrismaService) {}

  /* ================= CREATE ================= */

  async create(createQuizDto: CreateQuizDto) {
    const {
      title,
      courseId,
      subjectId,
      moduleId,
      chapterId,
      lessonId,
      timeLimit,
      passMarks,
      totalMarks,
    } = createQuizDto;

    const attachIds = [
      courseId,
      subjectId,
      moduleId,
      chapterId,
      lessonId,
    ].filter((v) => v !== undefined);

    if (attachIds.length !== 1) {
      throw new BadRequestException(
        'Quiz must be attached to exactly ONE level',
      );
    }

    const quiz = await this.prisma.quiz.create({
      data: {
        title,
        slug: generateSlug(title),
        timeLimit: timeLimit ?? 0,
        passMarks: passMarks ?? 0,
        totalMarks: totalMarks ?? 0,
        status: true,
      },
    });

    if (courseId) {
      await this.prisma.courseQuiz.create({
        data: { courseId, quizId: quiz.id },
      });
    }
    if (subjectId) {
      await this.prisma.subjectQuiz.create({
        data: { subjectId, quizId: quiz.id },
      });
    }
    if (moduleId) {
      await this.prisma.moduleQuiz.create({
        data: { moduleId, quizId: quiz.id },
      });
    }
    if (chapterId) {
      await this.prisma.chapterQuiz.create({
        data: { chapterId, quizId: quiz.id },
      });
    }
    if (lessonId) {
      await this.prisma.lessonQuiz.create({
        data: { lessonId, quizId: quiz.id },
      });
    }

    return quiz;
  }

  /* ================= READ ================= */

  async findAll(query: any) {
    const {
      courseId,
      subjectId,
      moduleId,
      chapterId,
      lessonId,
      status = true,
      page = 1,
      limit = 20,
    } = query;

    const attachIds = [
      courseId,
      subjectId,
      moduleId,
      chapterId,
      lessonId,
    ].filter((v) => v !== undefined);

    if (attachIds.length > 1) {
      throw new BadRequestException('Filter by only ONE level at a time');
    }

    const where: any = {
      status: status === 'false' ? false : true,
    };

    // Base query
    const baseQuery: any = {
      where,
      include: {
        questions: false,
      },
      skip: (page - 1) * limit,
      take: +limit,
      orderBy: { createdAt: 'desc' },
    };

    // LEVEL FILTERS
    if (courseId) {
      baseQuery.where.courseQuizzes = {
        some: { courseId: +courseId },
      };
    }

    if (subjectId) {
      baseQuery.where.subjectQuizzes = {
        some: { subjectId: +subjectId },
      };
    }

    if (moduleId) {
      baseQuery.where.moduleQuizzes = {
        some: { moduleId: +moduleId },
      };
    }

    if (chapterId) {
      baseQuery.where.chapterQuizzes = {
        some: { chapterId: +chapterId },
      };
    }

    if (lessonId) {
      baseQuery.where.lessons = {
        some: { lessonId: +lessonId },
      };
    }

    return this.prisma.quiz.findMany(baseQuery);
  }

  async findOne(id: number) {
    return this.prisma.quiz.findUnique({
      where: { id },
      include: {
        questions: {
          where: { status: true },
          include: { options: true },
        },
      },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.quiz.findUnique({
      where: { slug },
      include: {
        questions: {
          where: { status: true },
          include: { options: true },
        },
      },
    });
  }

  /* ================= UPDATE ================= */

  async update(id: number, dto: UpdateQuizDto) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id } });
    if (!quiz) throw new NotFoundException('Quiz not found');

    return this.prisma.quiz.update({
      where: { id },
      data: {
        title: dto.title ?? quiz.title,
        slug: dto.title ? generateSlug(dto.title) : quiz.slug,
        timeLimit: dto.timeLimit ?? quiz.timeLimit,
        passMarks: dto.passMarks ?? quiz.passMarks,
        totalMarks: dto.totalMarks ?? quiz.totalMarks,
      },
    });
  }

  async updateStatus(id: number) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id } });
    if (!quiz) throw new NotFoundException('Quiz not found');

    return this.prisma.quiz.update({
      where: { id },
      data: { status: !quiz.status },
    });
  }

  /* ================= SUBMIT ================= */

  async submitQuiz(userId: number, quizId: number, submitData: SubmitQuizDto) {
    const alreadyAttempted = await this.prisma.quizAttempt.findFirst({
      where: {
        quizId,
        userId,
      },
    });

    if (alreadyAttempted) {
      throw new BadRequestException('Quiz already attempted');
    }
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: { include: { options: true } },
      },
    });

    if (!quiz) throw new NotFoundException('Quiz not found');

    let obtainedMarks = 0;
    let correctAnswers = 0;

    const answers = submitData.answers.map((a) => {
      const q = quiz.questions.find((x) => x.id === a.questionId);
      if (!q) throw new NotFoundException('Invalid question');

      const correct = this.gradeAnswer(q, a.answer).isCorrect;

      if (correct) {
        obtainedMarks += Number(q.marks);
        correctAnswers++;
      }

      return {
        questionId: q.id,
        obtainedMarks: correct ? Number(q.marks) : 0,
        totalMarks: Number(q.marks),
        isCorrect: correct,
      };
    });
    const totalMarks = quiz.questions.reduce(
      (sum, q) => sum + Number(q.marks),
      0,
    );
    const attempt = await this.prisma.quizAttempt.create({
      data: {
        quizId,
        userId,
        obtainedMarks,
        totalMarks,
        correctAnswers,
        totalQuestions: quiz.questions.length,
        timeTaken: submitData.timeTaken ?? 0,
        answers: { create: answers },
      },
      include: { answers: true },
    });

    /* 🎯 XP ONLY IF QUIZ IS ATTACHED TO LESSON */
    const lessonQuiz = await this.prisma.lessonQuiz.findFirst({
      where: { quizId },
      include: { lesson: true },
    });

    if (lessonQuiz && obtainedMarks >= quiz.passMarks) {
      const exists = await this.prisma.userXPEarned.findFirst({
        where: {
          userId,
          lessonId: lessonQuiz.lessonId,
        },
      });

      if (!exists) {
        await this.prisma.userXPEarned.create({
          data: {
            userId,
            lessonId: lessonQuiz.lessonId,
            quizId,
            xpPoints: lessonQuiz.lesson.noOfXpPoints,
          },
        });
      }
    }
    const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;
    return {
      attemptId: attempt.id,
      obtainedMarks,
      totalMarks,
      passMarks: quiz.passMarks,
      percentage: percentage,
      passed: obtainedMarks >= quiz.passMarks,
    };
  }

  /* ================= HELPERS ================= */

  private gradeAnswer(question: any, userAnswer: string | string[]) {
    if (question.type === 'MCQ' || question.type === 'TRUEORFALSE') {
      const correct = question.options.find((o) => o.isCorrect);
      return { isCorrect: correct?.option === userAnswer };
    }

    if (question.type === 'FILLINTHEBLANK') {
      return {
        isCorrect:
          question.answer?.toLowerCase().trim() ===
          String(userAnswer).toLowerCase().trim(),
      };
    }

    return { isCorrect: false };
  }

  async createQuizAndAttach(
    tx: any,
    quizData: {
      title: string;
      timeLimit?: number;
      passMarks?: number;
      totalMarks?: number;
    },
    attach: {
      courseId?: number;
      subjectId?: number;
      moduleId?: number;
      chapterId?: number;
      lessonId?: number;
    },
  ) {
    const quiz = await tx.quiz.create({
      data: {
        title: quizData.title,
        slug: generateSlug(quizData.title),
        timeLimit: quizData.timeLimit ?? 0,
        passMarks: quizData.passMarks ?? 0,
        totalMarks: quizData.totalMarks ?? 0,
      },
    });

    if (attach.courseId) {
      await tx.courseQuiz.create({
        data: { courseId: attach.courseId, quizId: quiz.id },
      });
    }
    if (attach.subjectId) {
      await tx.subjectQuiz.create({
        data: { subjectId: attach.subjectId, quizId: quiz.id },
      });
    }
    if (attach.moduleId) {
      await tx.moduleQuiz.create({
        data: { moduleId: attach.moduleId, quizId: quiz.id },
      });
    }
    if (attach.chapterId) {
      await tx.chapterQuiz.create({
        data: { chapterId: attach.chapterId, quizId: quiz.id },
      });
    }
    if (attach.lessonId) {
      await tx.lessonQuiz.create({
        data: { lessonId: attach.lessonId, quizId: quiz.id },
      });
    }

    return quiz;
  }
}
