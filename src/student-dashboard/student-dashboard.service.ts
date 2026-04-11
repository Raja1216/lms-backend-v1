import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class StudentDashboardService {
  constructor(private readonly prisma: PrismaService) {}
  async getStudentAnalytics(studentId: number, courseId: number) {
    const quizAttempts = await this.prisma.quizAttempt.findMany({
      where: { userId: studentId },
      include: {
        quiz: {
          include: {
            questions: {
              include: {
                questionAttempts: {
                  where: {
                    quizAttempt: { userId: studentId },
                  },
                },
              },
            },
            courseQuizzes: { where: { courseId } },
            subjectQuizzes: {
              include: {
                subject: {
                  include: {
                    courses: { where: { courseId } },
                  },
                },
              },
            },
            chapterQuizzes: {
              include: {
                chapter: {
                  include: {
                    subjects: {
                      include: {
                        subject: {
                          include: { courses: { where: { courseId } } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        answers: {
          include: {
            question: true,
          },
        },
      },
    });

    // Filter only attempts for quizzes belonging to this course
    const courseAttempts = quizAttempts.filter((attempt: any) => {
      const q = attempt.quiz;
      return (
        q.courseQuizzes.length > 0 ||
        q.subjectQuizzes.some((sq: any) => sq.subject.courses.length > 0) ||
        q.chapterQuizzes.some((cq: any) =>
          cq.chapter.subjects.some((sc: any) => sc.subject.courses.length > 0),
        )
      );
    });
    const difficultyStats = {
      easy: { attempted: 0, correct: 0, notattempted: 0 },
      medium: { attempted: 0, correct: 0, notattempted: 0 },
      hard: { attempted: 0, correct: 0, notattempted: 0 },
    };
    courseAttempts.forEach((attempt) => {
      const answeredQuestionIds = new Set(
        attempt.answers.map((a) => a.questionId),
      );

      attempt.quiz.questions.forEach((q) => {
        const diff = q.difficulty as 'easy' | 'medium' | 'hard';

        if (answeredQuestionIds.has(q.id)) {
          difficultyStats[diff].attempted++;

          const ans = attempt.answers.find((a) => a.questionId === q.id);
          if (ans?.isCorrect) {
            difficultyStats[diff].correct++;
          }
        } else {
          difficultyStats[diff].notattempted++;
        }
      });
    });

    const bloomStats: Record<
      string,
      { attempted: number; correct: number; notattempted: number }
    > = {
      remember: { attempted: 0, correct: 0, notattempted: 0 },
      understand: { attempted: 0, correct: 0, notattempted: 0 },
      apply: { attempted: 0, correct: 0, notattempted: 0 },
      analyze: { attempted: 0, correct: 0, notattempted: 0 },
      evaluate: { attempted: 0, correct: 0, notattempted: 0 },
      create: { attempted: 0, correct: 0, notattempted: 0 },
    };
    courseAttempts.forEach((attempt) => {
      const answeredQuestionIds = new Set(
        attempt.answers.map((a) => a.questionId),
      );

      attempt.quiz.questions.forEach((q) => {
        const level = q.bloomLevel;

        if (answeredQuestionIds.has(q.id)) {
          bloomStats[level].attempted++;

          const ans = attempt.answers.find((a) => a.questionId === q.id);
          if (ans?.isCorrect) {
            bloomStats[level].correct++;
          }
        } else {
          bloomStats[level].notattempted++;
        }
      });
    });
    const courseSubjects = await this.prisma.courseSubject.findMany({
      where: { courseId },
      include: {
        subject: {
          include: {
            chapters: {
              include: {
                chapter: {
                  include: {
                    chapterQuizzes: {
                      include: {
                        quiz: {
                          include: {
                            questions: true,
                            quizAttempts: {
                              where: { userId: studentId },
                              include: {
                                answers: { include: { question: true } },
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
    });

    const chapterReports: any = [];
    for (const cs of courseSubjects) {
      for (const sc of cs.subject.chapters) {
        const ch = sc.chapter;
        let timeSpent = 0,
          questionsAttempted = 0,
          correctAnswers = 0;
        const diffBreakdown = {
          easy: { attempted: 0, correct: 0, notattempted: 0 },
          medium: { attempted: 0, correct: 0, notattempted: 0 },
          hard: { attempted: 0, correct: 0, notattempted: 0 },
        };

        for (const cq of ch.chapterQuizzes) {
          for (const attempt of cq.quiz.quizAttempts) {
            timeSpent += attempt.timeTaken;

            const answerMap = new Map(
              attempt.answers.map((a) => [a.questionId, a]),
            );

            cq.quiz.questions.forEach((q) => {
              const diff = q.difficulty as 'easy' | 'medium' | 'hard';
              const ans = answerMap.get(q.id);

              if (ans) {
                questionsAttempted++;
                diffBreakdown[diff].attempted++;

                if (ans.isCorrect) {
                  correctAnswers++;
                  diffBreakdown[diff].correct++;
                }
              } else {
                diffBreakdown[diff].notattempted++;
              }
            });
          }
        }

        chapterReports.push({
          chapterId: ch.id,
          chapterName: ch.title,
          subjectId: cs.subject.id,
          subjectName: cs.subject.name,
          timeSpent,
          questionsAttempted,
          correctAnswers,
          difficultyBreakdown: diffBreakdown,
        });
      }
      return {
        difficultyStats,
        bloomStats,
        chapterReports,
        totalTimeSpent: courseAttempts.reduce((s, a) => s + a.timeTaken, 0),
        totalQuestions: courseAttempts.reduce(
          (s, a) => s + a.totalQuestions,
          0,
        ),
        totalCorrect: courseAttempts.reduce((s, a) => s + a.correctAnswers, 0),
      };
    }
  }
}
