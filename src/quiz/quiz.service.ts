import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { generateSlug } from 'src/shared/generate-slug';
import { SubmitQuizDto } from './dto/submit-quiz.dto';

@Injectable()
export class QuizService {
  constructor(private prisma: PrismaService) {}

  async create(createQuizDto: CreateQuizDto) {
    const { title, lessonIds } = createQuizDto;
    const slug = generateSlug(title);
    const quiz = await this.prisma.quiz.create({
      data: {
        title,
        timeLimit: 0,
        slug,
      },
    });
    const lessonQuizs: any[] = [];
    // Associate lessons with the quiz
    for (const lessonId of lessonIds) {
      const lessonQuiz = await this.prisma.lessonQuiz.create({
        data: {
          lessonId,
          quizId: quiz.id,
        },
      });
      lessonQuizs.push(lessonQuiz);
    }
    return { ...quiz, lessons: lessonQuizs };
  }

  findAll() {
    return `This action returns all quiz`;
  }

  async findOne(id: number) {
    return await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        questions: {
          where: { status: true },
          select: {
            id: true,
            question: true,
            options: {
              select: {
                option: true,
              },
            },
            type: true,
            marks: true,
          },
        },
      },
    });
  }

  async findBySlug(slug: string) {
    return await this.prisma.quiz.findUnique({
      where: { slug },
      include: {
        questions: {
          where: { status: true },
          select: {
            id: true,
            question: true,
            options: {
              select: {
                option: true,
              },
            },
            type: true,
            marks: true,
          },
        },
      },
    });
  }

  async update(id: number, updateQuizDto: UpdateQuizDto) {
    const existingQuiz = await this.findOne(id);
    if (!existingQuiz) {
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }
    const { title, lessonIds } = updateQuizDto;
    const slug = title ? generateSlug(title) : existingQuiz.slug;

    const updatedQuiz = await this.prisma.quiz.update({
      where: { id },
      data: {
        title: title ?? existingQuiz.title,
        slug,
      },
    });
    const lessonQuizs: any[] = [];

    if (lessonIds) {
      // Remove existing associations
      await this.prisma.lessonQuiz.deleteMany({
        where: { quizId: id },
      });

      // Create new associations
      for (const lessonId of lessonIds) {
        const lessonQuizes = await this.prisma.lessonQuiz.create({
          data: {
            lessonId,
            quizId: id,
          },
        });
        lessonQuizs.push(lessonQuizes);
      }
    }

    return { ...updatedQuiz, lessons: lessonQuizs };
  }

  async updateStatus(id: number) {
    const existingQuiz = await this.findOne(id);
    if (!existingQuiz) {
      throw new NotFoundException('Quiz Not Found');
    }
    return await this.prisma.quiz.update({
      where: { id },
      data: {
        status: !existingQuiz.status,
      },
    });
  }

  async submitQuiz(userId: number, quizId: number, submitData: SubmitQuizDto) {
    // Fetch quiz with questions and correct answers
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          include: {
            options: true,
          },
        },
      },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // Validate all questions are answered
    const answeredQuestionIds = submitData.answers.map((a) => a.questionId);
    const allQuestionIds = quiz.questions.map((q) => q.id);

    // const missingQuestions = allQuestionIds.filter(
    //   (id) => !answeredQuestionIds.includes(id),
    // );

    // if (missingQuestions.length > 0) {
    //   throw new BadRequestException(
    //     `Missing answers for questions: ${missingQuestions.join(', ')}`,
    //   );
    // }

    let correctAnswers = 0;
    let obtainedMarks = 0;

    // Grade each answer
    const questionAttempts = submitData.answers.map((userAnswer) => {
      const question = quiz.questions.find(
        (q) => q.id === userAnswer.questionId,
      );

      if (!question) {
        throw new NotFoundException(
          `Question ${userAnswer.questionId} not found`,
        );
      }

      const result = this.gradeAnswer(question, userAnswer.answer);

      if (result.isCorrect) {
        correctAnswers++;
        obtainedMarks += Number(question.marks);
      }

      return {
        questionId: question.id,
        obtainedMarks: result.isCorrect ? Number(question.marks) : 0,
        totalMarks: Number(question.marks),
        isCorrect: result.isCorrect,
      };
    });

    // Create quiz attempt
    const quizAttempt = await this.prisma.quizAttempt.create({
      data: {
        quizId,
        userId,
        obtainedMarks,
        totalMarks: Number(quiz.totalMarks),
        correctAnswers,
        totalQuestions: quiz.questions.length,
        timeTaken: submitData.timeTaken || 0,
        answers: {
          create: questionAttempts,
        },
      },
      include: {
        answers: {
          include: {
            question: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    });

    const passed = obtainedMarks >= Number(quiz.passMarks);
    // If quiz passed, try awarding lesson XP
    if (passed) {
      // Find lesson connected to this quiz
      const lesson = await this.prisma.lesson.findFirst({
        where: {
          quizzes: {
            some: {
              quizId: quizId,
            },
          },
        },
        select: {
          id: true,
          noOfXpPoints: true,
        },
      });

      if (lesson) {
        // Check if lesson XP already earned
        const lessonXpAlreadyEarned = await this.prisma.userXPEarned.findFirst({
          where: {
            userId,
            lessonId: lesson.id,
          },
        });

        if (!lessonXpAlreadyEarned) {
          // Award lesson XP
          await this.prisma.$transaction([
            this.prisma.userXPEarned.create({
              data: {
                userId,
                lessonId: lesson.id,
                quizId: quizId,
                xpPoints: lesson.noOfXpPoints,
              },
            }),
          ]);
        }
      }
    }

    return {
      attemptId: quizAttempt.id,
      obtainedMarks,
      totalMarks: Number(quiz.totalMarks),
      passMarks: Number(quiz.passMarks),
      correctAnswers,
      totalQuestions: quiz.questions.length,
      percentage: (obtainedMarks / Number(quiz.totalMarks)) * 100,
      passed,
      timeTaken: quizAttempt.timeTaken,
      answers: quizAttempt.answers.map((attempt) => ({
        questionId: attempt.questionId,
        question: attempt.question.question,
        isCorrect: attempt.isCorrect,
        obtainedMarks: Number(attempt.obtainedMarks),
        totalMarks: Number(attempt.totalMarks),
        correctAnswer: this.getCorrectAnswer(attempt.question),
      })),
    };
  }

  private gradeAnswer(
    question: any,
    userAnswer: string | string[],
  ): { isCorrect: boolean } {
    switch (question.type) {
      case 'MCQ':
      case 'TRUEORFALSE':
        const correctOption = question.options.find((opt) => opt.isCorrect);
        return {
          isCorrect: correctOption
            ? correctOption.option === userAnswer
            : false,
        };

      case 'FILLINTHEBLANK':
        // Case-insensitive comparison, trim whitespace
        const correctAnswer = question.answer?.toLowerCase().trim();
        const userAnswerStr = String(userAnswer).toLowerCase().trim();
        return {
          isCorrect: correctAnswer === userAnswerStr,
        };

      case 'SHORTANSWER':
      case 'DESCRIPTIVE':
        // For these types, you might want to implement more sophisticated grading
        // For now, we'll do a simple keyword matching or mark for manual review
        // You could integrate AI-based grading here
        return { isCorrect: false }; // Requires manual grading

      default:
        return { isCorrect: false };
    }
  }

  private getCorrectAnswer(question: any): string {
    switch (question.type) {
      case 'MCQ':
      case 'TRUEORFALSE':
        const correctOption = question.options.find((opt) => opt.isCorrect);
        return correctOption?.option || 'N/A';

      case 'FILLINTHEBLANK':
      case 'SHORTANSWER':
      case 'DESCRIPTIVE':
        return question.answer || 'N/A';

      default:
        return 'N/A';
    }
  }

  async getQuizAttempts(userId: number, quizId: number) {
    return this.prisma.quizAttempt.findMany({
      where: {
        userId,
        quizId,
      },
      include: {
        answers: {
          include: {
            question: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getAttemptDetails(attemptId: number, userId: number) {
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: {
        id: attemptId,
        userId,
      },
      include: {
        quiz: true,
        answers: {
          include: {
            question: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException('Quiz attempt not found');
    }

    return attempt;
  }
  remove(id: number) {
    return `This action removes a #${id} quiz`;
  }

  async findQuizByTitle(title: string, id?: number): Promise<boolean> {
    const quiz = await this.prisma.quiz.findFirst({
      where: {
        title: title,
        ...(id && { id: { not: id } }),
      },
    });
    return !!quiz;
  }
}
