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
      easy: { attempted: 0, correct: 0 },
      medium: { attempted: 0, correct: 0 },
      hard: { attempted: 0, correct: 0 },
    };
    courseAttempts.forEach((attempt) => {
      attempt.answers.forEach((ans) => {
        const diff = ans.question.difficulty as 'easy' | 'medium' | 'hard';
        difficultyStats[diff].attempted++;
        if (ans.isCorrect) difficultyStats[diff].correct++;
      });
    });

    const bloomStats: Record<string, { attempted: number; correct: number }> = {
      remember: { attempted: 0, correct: 0 },
      understand: { attempted: 0, correct: 0 },
      apply: { attempted: 0, correct: 0 },
      analyze: { attempted: 0, correct: 0 },
      evaluate: { attempted: 0, correct: 0 },
      create: { attempted: 0, correct: 0 },
    };
    courseAttempts.forEach((attempt) => {
      attempt.answers.forEach((ans) => {
        const level = ans.question.bloomLevel;
        bloomStats[level].attempted++;
        if (ans.isCorrect) bloomStats[level].correct++;
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
          easy: { attempted: 0, correct: 0 },
          medium: { attempted: 0, correct: 0 },
          hard: { attempted: 0, correct: 0 },
        };

        for (const cq of ch.chapterQuizzes) {
          for (const attempt of cq.quiz.quizAttempts) {
            timeSpent += attempt.timeTaken;
            questionsAttempted += attempt.answers.length;
            correctAnswers += attempt.answers.filter((a) => a.isCorrect).length;
            attempt.answers.forEach((ans) => {
              const diff = ans.question.difficulty as
                | 'easy'
                | 'medium'
                | 'hard';
              diffBreakdown[diff].attempted++;
              if (ans.isCorrect) diffBreakdown[diff].correct++;
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
