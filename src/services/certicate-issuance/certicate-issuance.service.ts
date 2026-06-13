import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CertificateGeneratorService,
  CourseCertArgs,
  QuizCertArgs,
} from '../certicate-generator/certicate-generator.service';

import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Injectable()
export class CertificateIssuanceService {
  private readonly logger = new Logger(CertificateIssuanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly generator: CertificateGeneratorService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async checkAndIssueCourseCompletion(
    userId: number,
    courseId: number,
  ): Promise<void> {
    try {
      const existing = await this.prisma.userCompletionCertificate.findFirst({
        where: { userId: userId, courseId: courseId },
      });
      if (existing) return;
      const allLessons = await this.prisma.lesson.findMany({
        where: {
          chapters: {
            some: {
              chapter: {
                subjects: {
                  some: {
                    subject: {
                      courses: { some: { courseId } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ sortOrder: 'asc' }],
        select: { id: true },
      });
      const lessonIds = allLessons.map((l) => l.id);
      const allQuizIds = await this.getAllCourseQuizIds(courseId, lessonIds);

      if (lessonIds.length > 0) {
        const completedLessons = await this.prisma.userXPEarned.findMany({
          where: { userId, lessonId: { in: lessonIds } },
          select: { lessonId: true },
          distinct: ['lessonId'],
        });

        if (completedLessons.length < lessonIds.length) return;
      } else if (allQuizIds.length === 0) {
        return;
      }

      if (allQuizIds.length > 0) {
        const attemptedQuizIds = await this.prisma.quizAttempt.findMany({
          where: { userId, quizId: { in: allQuizIds } },
          select: { quizId: true },
          distinct: ['quizId'],
        });
        if (attemptedQuizIds.length < allQuizIds.length) return; // quizzes pending
      }
      await this.createCourseCertificate(userId, courseId);
    } catch (err) {
      this.logger.error(
        `Course cert check failed [user=${userId} course=${courseId}]`,
        err,
      );
    }
  }
  async issueQuizCertificateIfEligible(
    userId: number,
    quizId: number,
    quizAttemptId: number,
    passed: boolean,
  ): Promise<void> {
    // if (!passed) return; // Optionally only issue certs for passed attempts
    console.log(
      `Checking quiz cert issuance for user ${userId} on quiz ${quizId} attempt ${quizAttemptId}`,
    );
    try {
      const quiz = await this.prisma.quiz.findUnique({
        where: { id: quizId },
        select: { id: true, title: true, subMissionFrequency: true },
      });

      if (!quiz || quiz.subMissionFrequency !== 'once') return;

      // Already issued?
      const existing = await this.prisma.userCompletionCertificate.findFirst({
        where: { userId, quizId },
      });
      if (existing) return;

      await this.createQuizCertificate(userId, quizId, quizAttemptId);
    } catch (err) {
      this.logger.error(
        `Quiz cert issue failed [user=${userId} quiz=${quizId}]`,
        err,
      );
    }
  }

  private async getAllCourseQuizIds(
    courseId: number,
    lessonIds: number[],
  ): Promise<number[]> {
    const [
      courseQuizzes,
      lessonQuizzes,
      subjectQuizzes,
      chapterQuizzes,
      moduleQuizzes,
    ] = await Promise.all([
      // Direct course quizzes
      this.prisma.courseQuiz.findMany({
        where: { courseId },
        select: { quizId: true },
      }),
      // Via lessons
      this.prisma.lessonQuiz.findMany({
        where: { lessonId: { in: lessonIds } },
        select: { quizId: true },
      }),
      // Via subjects
      this.prisma.subjectQuiz.findMany({
        where: {
          subject: { courses: { some: { courseId } } },
        },
        select: { quizId: true },
      }),
      // Via chapters
      this.prisma.chapterQuiz.findMany({
        where: {
          chapter: {
            subjects: {
              some: { subject: { courses: { some: { courseId } } } },
            },
          },
        },
        select: { quizId: true },
      }),
      // Via modules
      this.prisma.moduleQuiz.findMany({
        where: {
          module: { subject: { courses: { some: { courseId } } } },
        },
        select: { quizId: true },
      }),
    ]);

    const allIds = [
      ...courseQuizzes,
      ...lessonQuizzes,
      ...subjectQuizzes,
      ...chapterQuizzes,
      ...moduleQuizzes,
    ].map((q) => q.quizId);

    return [...new Set(allIds)];
  }

  private async createCourseCertificate(
    userId: number,
    courseId: number,
  ): Promise<void> {
    const [user, course] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, schoolName: true, classGrade: true, section: true },
      }),
      this.prisma.course.findUnique({
        where: { id: courseId },
        select: { title: true, grade: true },
      }),
    ]);

    if (!user || !course) return;
    const certificateId = `course-${courseId}-user-${userId}`;

    const args: CourseCertArgs = {
      studentName: user.name ?? 'Student',
      className: user.classGrade ?? course.grade ?? '',
      schoolName: user.schoolName ?? '',
      courseName: course.title,
      grade: course.grade ?? '',
      teacherRemarks: '', // Can be enriched later if needed
      completionDate: new Date().toISOString().split('T')[0],
      certificateId,
    };

    const { filePath, fileUrl } =
      await this.generator.generateCourseCertificate(args);

    await this.prisma.userCompletionCertificate.create({
      data: {
        userId,
        courseId,
        filePath,
        fileUrl,
      },
    });

    try {
      await this.activityLogService.logActivity(userId, 'Certificate Generated', courseId);
    } catch (err) {
      this.logger.error('Failed to log Certificate Generated activity for course', err);
    }

    this.logger.log(
      `Course completion certificate issued [user=${userId} course=${courseId}]`,
    );
  }

  private getGradeByMarks(obtainedMarks: number, totalMarks: number) {
    const percentage = (obtainedMarks / totalMarks) * 100;
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
  }

  private async createQuizCertificate(
    userId: number,
    quizId: number,
    quizAttemptId: number,
  ): Promise<void> {
    // Gather attempt details
    // const attempt = await this.prisma.quizAttempt.findUnique({
    //   where: { id: quizAttemptId },
    //   select: {
    //     obtainedMarks: true,
    //     totalMarks: true,
    //     quiz: {
    //       select: {
    //         title: true,
    //         courseQuizzes: {
    //           take: 1,
    //           select: {
    //             course: { select: { id: true, title: true, grade: true } },
    //           },
    //         },
    //       },
    //     },
    //   },
    // });

    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: quizAttemptId },
      select: {
        obtainedMarks: true,
        totalMarks: true,
        quiz: {
          select: {
            title: true,

            // Direct Course Quiz
            courseQuizzes: {
              take: 1,
              select: {
                course: {
                  select: {
                    id: true,
                    title: true,
                    grade: true,
                  },
                },
              },
            },

            // Subject Quiz
            subjectQuizzes: {
              take: 1,
              select: {
                subject: {
                  select: {
                    courses: {
                      take: 1,
                      select: {
                        course: {
                          select: {
                            id: true,
                            title: true,
                            grade: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },

            // Module Quiz
            moduleQuizzes: {
              take: 1,
              select: {
                module: {
                  select: {
                    subject: {
                      select: {
                        courses: {
                          take: 1,
                          select: {
                            course: {
                              select: {
                                id: true,
                                title: true,
                                grade: true,
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

            // Chapter Quiz
            chapterQuizzes: {
              take: 1,
              select: {
                chapter: {
                  select: {
                    subjects: {
                      take: 1,
                      select: {
                        subject: {
                          select: {
                            courses: {
                              take: 1,
                              select: {
                                course: {
                                  select: {
                                    id: true,
                                    title: true,
                                    grade: true,
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

            // Lesson Quiz
            lessons: {
              take: 1,
              select: {
                lesson: {
                  select: {
                    chapters: {
                      take: 1,
                      select: {
                        chapter: {
                          select: {
                            subjects: {
                              take: 1,
                              select: {
                                subject: {
                                  select: {
                                    courses: {
                                      take: 1,
                                      select: {
                                        course: {
                                          select: {
                                            id: true,
                                            title: true,
                                            grade: true,
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
                },
              },
            },
          },
        },
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        schoolName: true,
        classGrade: true,
        institutionMembers: {
          select: {
            institution: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!attempt || !user) return;

    const resolvedCourse =
      attempt.quiz.courseQuizzes?.[0]?.course ??
      attempt.quiz.subjectQuizzes?.[0]?.subject?.courses?.[0]?.course ??
      attempt.quiz.moduleQuizzes?.[0]?.module?.subject?.courses?.[0]?.course ??
      attempt.quiz.chapterQuizzes?.[0]?.chapter?.subjects?.[0]?.subject
        ?.courses?.[0]?.course ??
      attempt.quiz.lessons?.[0]?.lesson?.chapters?.[0]?.chapter?.subjects?.[0]
        ?.subject?.courses?.[0]?.course;

    const courseTitle = resolvedCourse?.title ?? '';
    const courseGrade = resolvedCourse?.grade ?? '';
    const courseId = resolvedCourse?.id;
    const certificateId = `quiz-${quizId}-attempt-${quizAttemptId}`;
    const args: QuizCertArgs = {
      studentName: user.name ?? 'Student',
      className: user.classGrade ?? courseGrade,
      examName: attempt.quiz.title,
      courseName: courseTitle,
      marks: `${Number(attempt.obtainedMarks)}/${Number(attempt.totalMarks)}`,
      completionDate: new Date().toISOString().split('T')[0],
      certificateId,
      teacherRemarks: '', // Can be enriched later if needed
      schoolName: user.schoolName ?? '',
      courseId: courseId,
      grade: this.getGradeByMarks(
        Number(attempt.obtainedMarks),
        Number(attempt.totalMarks),
      ),
    };

    const { filePath, fileUrl } =
      await this.generator.generateQuizCertificate(args);

    await this.prisma.userCompletionCertificate.create({
      data: {
        certificateNumber: certificateId,
        userId,
        quizId,
        quizAttemptId,
        filePath,
        fileUrl,
      },
    });

    try {
      await this.activityLogService.logActivity(userId, 'Certificate Generated', courseId);
    } catch (err) {
      this.logger.error('Failed to log Certificate Generated activity for quiz', err);
    }

    this.logger.log(
      `Quiz certificate issued [user=${userId} quiz=${quizId} attempt=${quizAttemptId}]`,
    );
  }
}
