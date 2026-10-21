import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class StudentDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStudentAnalytics(studentId: number, courseId: number) {
    const createStats = () => ({
      attempted: 0,
      correct: 0,
      notattempted: 0,
    });

    const createDifficultyStats = () => ({
      easy: createStats(),
      medium: createStats(),
      hard: createStats(),
    });

    const createBloomStats = () => ({
      remember: createStats(),
      understand: createStats(),
      apply: createStats(),
      analyze: createStats(),
      evaluate: createStats(),
      create: createStats(),
    });

    // STEP 1: Get course and subject quizzes,
    // plus chapter quizzes and lesson quizzes.
    const [courseQuizzes, subjectQuizzes, courseSubjects] = await Promise.all([
      this.prisma.courseQuiz.findMany({
        where: { courseId },
        select: { quizId: true },
      }),

      this.prisma.subjectQuiz.findMany({
        where: {
          subject: {
            courses: {
              some: { courseId },
            },
          },
        },
        select: { quizId: true },
      }),

      this.prisma.courseSubject.findMany({
        where: { courseId },
        select: {
          subject: {
            select: {
              id: true,
              name: true,
              chapters: {
                orderBy: {
                  chapter: { sortOrder: 'asc' },
                },
                select: {
                  chapter: {
                    select: {
                      id: true,
                      title: true,

                      // Direct chapter quizzes
                      chapterQuizzes: {
                        orderBy: {
                          quiz: { sortOrder: 'asc' },
                        },
                        select: {
                          quizId: true,
                        },
                      },

                      // NEW: Lesson quizzes within chapter
                      lessons: {
                        select: {
                          lesson: {
                            select: {
                              id: true,
                              quizzes: {
                                select: {
                                  quizId: true,
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    // STEP 2: Prepare analytics structures.
    const difficultyStats = createDifficultyStats();
    const bloomStats = createBloomStats();

    type ChapterReport = {
      chapterId: number;
      chapterName: string;
      subjectId: number;
      subjectName: string;
      timeSpent: number;
      questionsAttempted: number;
      correctAnswers: number;
      difficultyBreakdown: ReturnType<typeof createDifficultyStats>;
    };

    const chapterReports: ChapterReport[] = [];

    const quizIds = new Set<number>();

    // Identifies quizzes linked to lessons.
    const lessonQuizIds = new Set<number>();

    // A quiz may belong to multiple chapter reports.
    const chaptersByQuizId = new Map<number, ChapterReport[]>();

    const addChapterQuiz = (quizId: number, report: ChapterReport) => {
      quizIds.add(quizId);

      const reports = chaptersByQuizId.get(quizId) ?? [];

      if (!reports.includes(report)) {
        reports.push(report);
      }

      chaptersByQuizId.set(quizId, reports);
    };

    // Course quizzes
    for (const cq of courseQuizzes) {
      quizIds.add(cq.quizId);
    }

    // Subject quizzes
    for (const sq of subjectQuizzes) {
      quizIds.add(sq.quizId);
    }

    // Chapter and lesson quizzes
    for (const cs of courseSubjects) {
      for (const sc of cs.subject.chapters) {
        const chapter = sc.chapter;

        const report: ChapterReport = {
          chapterId: chapter.id,
          chapterName: chapter.title,
          subjectId: cs.subject.id,
          subjectName: cs.subject.name,
          timeSpent: 0,
          questionsAttempted: 0,
          correctAnswers: 0,
          difficultyBreakdown: createDifficultyStats(),
        };

        chapterReports.push(report);

        // Existing chapter quizzes
        for (const cq of chapter.chapterQuizzes) {
          addChapterQuiz(cq.quizId, report);
        }

        // NEW: Lesson quizzes
        for (const lc of chapter.lessons) {
          for (const lq of lc.lesson.quizzes) {
            lessonQuizIds.add(lq.quizId);

            // Include lesson quiz in this chapter report
            addChapterQuiz(lq.quizId, report);
          }
        }
      }
    }

    if (quizIds.size === 0) {
      return {
        difficultyStats,
        bloomStats,
        chapterReports,
        totalTimeSpent: 0,
        totalQuestions: 0,
        totalCorrect: 0,
      };
    }

    // STEP 3: Fetch only relevant student attempts.
    const allAttempts = await this.prisma.quizAttempt.findMany({
      where: {
        userId: studentId,
        quizId: {
          in: [...quizIds],
        },
      },
      select: {
        id: true,
        quizId: true,
        obtainedMarks: true,
        timeTaken: true,
        totalQuestions: true,
        correctAnswers: true,

        answers: {
          select: {
            questionId: true,
            isCorrect: true,
          },
        },

        quiz: {
          select: {
            subMissionFrequency: true,
            questions: {
              select: {
                id: true,
                difficulty: true,
                bloomLevel: true,
              },
            },
          },
        },
      },
    });

    // STEP 4: Select highest obtainedMarks
    // for each lesson quiz.
    const bestLessonAttempts = new Map<number, (typeof allAttempts)[number]>();

    for (const attempt of allAttempts) {
      if (!lessonQuizIds.has(attempt.quizId)) {
        continue;
      }

      const existing = bestLessonAttempts.get(attempt.quizId);

      // Select highest marks.
      // When marks are equal, use the latest attempt ID.
      if (
        !existing ||
        attempt.obtainedMarks.gt(existing.obtainedMarks) ||
        (attempt.obtainedMarks.equals(existing.obtainedMarks) &&
          attempt.id > existing.id)
      ) {
        bestLessonAttempts.set(attempt.quizId, attempt);
      }
    }

    // STEP 5: Final attempts used for analytics.
    const selectedAttempts = allAttempts.filter((attempt) => {
      // Regular quizzes: preserve all attempts
      if (!lessonQuizIds.has(attempt.quizId)) {
        return true;
      }

      // Lesson quizzes: take only the best attempt
      return bestLessonAttempts.get(attempt.quizId)?.id === attempt.id;
    });

    // STEP 6: Calculate analytics.
    let totalTimeSpent = 0;
    let totalQuestions = 0;
    let totalCorrect = 0;

    for (const attempt of selectedAttempts) {
      totalTimeSpent += attempt.timeTaken;
      totalQuestions += attempt.totalQuestions;
      totalCorrect += attempt.correctAnswers;

      const answerMap = new Map(
        attempt.answers.map((answer) => [answer.questionId, answer.isCorrect]),
      );

      const linkedChapters = chaptersByQuizId.get(attempt.quizId) ?? [];

      for (const report of linkedChapters) {
        report.timeSpent += attempt.timeTaken;
      }

      for (const question of attempt.quiz.questions) {
        const difficulty = question.difficulty;
        const bloomLevel = question.bloomLevel;

        const isAnswered = answerMap.has(question.id);
        const isCorrect = answerMap.get(question.id) === true;

        const difficultyStat = difficultyStats[difficulty];

        const bloomStat = bloomStats[bloomLevel];

        if (isAnswered) {
          difficultyStat.attempted++;
          bloomStat.attempted++;

          if (isCorrect) {
            difficultyStat.correct++;
            bloomStat.correct++;
          }
        } else {
          difficultyStat.notattempted++;
          bloomStat.notattempted++;
        }

        // Include lesson quizzes in chapter analytics.
        for (const report of linkedChapters) {
          const chapterDifficulty = report.difficultyBreakdown[difficulty];

          if (isAnswered) {
            report.questionsAttempted++;
            chapterDifficulty.attempted++;

            if (isCorrect) {
              report.correctAnswers++;
              chapterDifficulty.correct++;
            }
          } else {
            chapterDifficulty.notattempted++;
          }
        }
      }
    }
    console.log('All course quiz IDs:', [...quizIds]);

    console.log('Is assessment quiz 5264 included?', quizIds.has(5264));

    return {
      difficultyStats,
      bloomStats,
      chapterReports,
      totalTimeSpent,
      totalQuestions,
      totalCorrect,
    };
  }
}
