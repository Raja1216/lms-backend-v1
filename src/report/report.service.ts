import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
type AttemptType = {
  isCorrect: boolean;
  timeTaken: number;
  question: {
    difficulty: 'easy' | 'medium' | 'hard';
    bloomLevel:
      | 'remember'
      | 'understand'
      | 'apply'
      | 'analyze'
      | 'evaluate'
      | 'create';
  };
};
@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  async getReport(courseSlug: string, userId: number) {
    const course = await this.prisma.course.findUnique({
      where: { slug: courseSlug },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    // If user is not enrolled in the course, they should not see any report data
    const enrollment = await this.prisma.userEnrolledCourse.findFirst({
      where: { courseId: course.id, userId },
    });
    if (!enrollment) {
      throw new NotFoundException('Course not found');
    }
    // ✅ GET ALL QUIZ IDS
    // const quizIds = await this.getAllCourseQuizIds(course.id);
    // const attemptIds = await this.getAllAttemptedQuizes(quizIds, userId);
    // return {
    //   courseId: course.id,
    //   totalQuizzes: quizIds.length,
    //   quizIds,
    //   attemptIds,
    // };

    const quizIds = await this.getAllCourseQuizIds(course.id);

    const [attempts, totalQuestions] = await Promise.all([
      this.getUserQuestionAttempts(quizIds, userId),
      this.getTotalQuestions(quizIds),
    ]);

    return {
      summary: this.buildSummary(attempts, totalQuestions),
      difficulty: this.buildDifficulty(attempts),
      blooms: this.buildBlooms(attempts),
      behavior: this.buildBehavior(attempts),
      customChart: this.buildCustomChart(attempts),

      // placeholders (next step)
      chapters: [],
      speedVsAccuracy: [],
      improvement: {
        weakAreas: [],
        behaviorIssues: [],
        suggestions: [],
      },
    };
  }

  async getAllCourseQuizIds(courseId: number) {
    const quizIds = new Set<number>();

    // ✅ 1. Course level quizzes
    const courseQuizzes = await this.prisma.courseQuiz.findMany({
      where: { courseId },
      select: { quizId: true },
    });
    courseQuizzes.forEach((q) => quizIds.add(q.quizId));

    // ✅ 2. Get subject IDs
    const subjects = await this.prisma.courseSubject.findMany({
      where: { courseId },
      select: { subjectId: true },
    });

    const subjectIds = subjects.map((s) => s.subjectId);

    if (subjectIds.length === 0) return Array.from(quizIds);

    // ✅ 3. Subject quizzes
    const subjectQuizzes = await this.prisma.subjectQuiz.findMany({
      where: { subjectId: { in: subjectIds } },
      select: { quizId: true },
    });
    subjectQuizzes.forEach((q) => quizIds.add(q.quizId));

    // ✅ 4. Modules
    const modules = await this.prisma.module.findMany({
      where: { subjectId: { in: subjectIds } },
      select: { id: true },
    });
    const moduleIds = modules.map((m) => m.id);

    // Module quizzes
    if (moduleIds.length) {
      const moduleQuizzes = await this.prisma.moduleQuiz.findMany({
        where: { moduleId: { in: moduleIds } },
        select: { quizId: true },
      });
      moduleQuizzes.forEach((q) => quizIds.add(q.quizId));
    }

    // ✅ 5. Chapters
    const moduleChapters = await this.prisma.moduleChapter.findMany({
      where: { moduleId: { in: moduleIds } },
      select: { chapterId: true },
    });
    const chapterIds = moduleChapters.map((c) => c.chapterId);

    // Chapter quizzes
    if (chapterIds.length) {
      const chapterQuizzes = await this.prisma.chapterQuiz.findMany({
        where: { chapterId: { in: chapterIds } },
        select: { quizId: true },
      });
      chapterQuizzes.forEach((q) => quizIds.add(q.quizId));
    }

    // ✅ 6. Lessons
    const lessonChapters = await this.prisma.lessonToChapter.findMany({
      where: { chapterId: { in: chapterIds } },
      select: { lessonId: true },
    });
    const lessonIds = lessonChapters.map((l) => l.lessonId);

    // Lesson quizzes
    if (lessonIds.length) {
      const lessonQuizzes = await this.prisma.lessonQuiz.findMany({
        where: { lessonId: { in: lessonIds } },
        select: { quizId: true },
      });
      lessonQuizzes.forEach((q) => quizIds.add(q.quizId));
    }

    return Array.from(quizIds);
  }

  async getAllAttemptedQuizes(quizIds: number[], userId: number) {
    const attemptedQuiz = await this.prisma.quizAttempt.findMany({
      where: { quizId: { in: quizIds }, userId },
      select: { id: true },
    });
    return attemptedQuiz.map((a) => a.id);
  }

  async getUserQuestionAttempts(
    quizIds: number[],
    userId: number,
  ): Promise<AttemptType[]> {
    return this.prisma.questionAttempt.findMany({
      where: {
        quizAttempt: {
          userId,
          quizId: { in: quizIds },
        },
      },
      select: {
        isCorrect: true,
        timeTaken: true,
        question: {
          select: {
            difficulty: true,
            bloomLevel: true,
          },
        },
      },
    });
  }

  async getTotalQuestions(quizIds: number[]) {
    const questions = await this.prisma.question.findMany({
      where: { quizId: { in: quizIds } },
      select: { id: true },
    });

    return questions.length;
  }

  buildSummary(attempts: AttemptType[], totalQuestions: number) {
    const attempted = attempts.length;
    const correct = attempts.filter((a) => a.isCorrect).length;
    const incorrect = attempted - correct;
    const totalTime = attempts.reduce((sum, a) => sum + (a.timeTaken || 0), 0);

    return {
      totalQuestions,
      attempted,
      notAttempted: totalQuestions - attempted,
      correct,
      incorrect,
      accuracy: attempted ? Math.round((correct / attempted) * 100) : 0,
      attemptRate: totalQuestions
        ? Math.round((attempted / totalQuestions) * 100)
        : 0,
      totalTime,
      avgTimePerQuestion: attempted ? Math.round(totalTime / attempted) : 0,
    };
  }

  buildDifficulty(attempts: AttemptType[]) {
    const levels: AttemptType['question']['difficulty'][] = [
      'easy',
      'medium',
      'hard',
    ];

    const result: Record<
      string,
      { total: number; correct: number; accuracy: number }
    > = {};

    levels.forEach((level) => {
      const filtered = attempts.filter((a) => a.question?.difficulty === level);

      const correct = filtered.filter((a) => a.isCorrect).length;

      result[level] = {
        total: filtered.length,
        correct,
        accuracy: filtered.length
          ? Math.round((correct / filtered.length) * 100)
          : 0,
      };
    });

    return result;
  }

  buildBlooms(attempts: AttemptType[]) {
    const levels: AttemptType['question']['bloomLevel'][] = [
      'remember',
      'understand',
      'apply',
      'analyze',
      'evaluate',
      'create',
    ];

    return levels.map((level) => {
      const filtered = attempts.filter((a) => a.question?.bloomLevel === level);

      const correct = filtered.filter((a) => a.isCorrect).length;

      return {
        level,
        accuracy: filtered.length
          ? Math.round((correct / filtered.length) * 100)
          : 0,
      };
    });
  }

  buildBehavior(attempts: AttemptType[]) {
    let fastCorrect = 0;
    let guessing = 0;
    let careful = 0;
    let struggling = 0;

    attempts.forEach((a) => {
      const time = a.timeTaken || 0;

      if (time < 10 && a.isCorrect) fastCorrect++;
      else if (time < 5 && !a.isCorrect) guessing++;
      else if (time > 20 && a.isCorrect) careful++;
      else if (time > 20 && !a.isCorrect) struggling++;
    });

    return {
      fastCorrect,
      guessing,
      careful,
      struggling,
    };
  }

  buildCustomChart(attempts: AttemptType[]) {
    const correct = attempts.filter((a) => a.isCorrect);
    const incorrect = attempts.filter((a) => !a.isCorrect);

    const getAvg = (arr: AttemptType[]) =>
      arr.length
        ? Math.round(
            arr.reduce((s, a) => s + (a.timeTaken || 0), 0) / arr.length,
          )
        : 0;

    return {
      correct: {
        avgTime: getAvg(correct),
        count: correct.length,
      },
      incorrect: {
        avgTime: getAvg(incorrect),
        count: incorrect.length,
      },
      notAttempted: {
        avgTime: 0,
        count: 0,
      },
    };
  }
}
