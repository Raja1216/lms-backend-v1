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
    } = createQuizDto;

    const attachIds = [courseId, subjectId, moduleId, chapterId, lessonId]
      .filter((v) => v !== undefined);

    if (attachIds.length !== 1) {
      throw new BadRequestException(
        'Quiz must be attached to exactly ONE level',
      );
    }

    const quiz = await this.prisma.quiz.create({
      data: {
        title,
        slug: generateSlug(title),
        timeLimit: 0,
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

  async update(id: number, updateQuizDto: UpdateQuizDto) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id } });
    if (!quiz) throw new NotFoundException('Quiz not found');

    return this.prisma.quiz.update({
      where: { id },
      data: {
        title: updateQuizDto.title ?? quiz.title,
        slug: updateQuizDto.title
          ? generateSlug(updateQuizDto.title)
          : quiz.slug,
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

    const attempt = await this.prisma.quizAttempt.create({
      data: {
        quizId,
        userId,
        obtainedMarks,
        totalMarks: quiz.totalMarks,
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
    const percentage =
      quiz.totalMarks > 0
      ? (obtainedMarks / quiz.totalMarks) * 100
      : 0;
    return {
      attemptId: attempt.id,
      obtainedMarks,
      totalMarks: quiz.totalMarks,
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
}
