import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { generateUniqueSlugForTable } from 'src/shared/generate-unique-slug-for-table';
import { QuizSubmissionFrequency } from 'src/generated/prisma/enums';
import { CertificateIssuanceService } from 'src/services/certicate-issuance/certicate-issuance.service';
import { SortOrder } from 'src/generated/prisma/internal/prismaNamespace';
@Injectable()
export class QuizService {
  constructor(
    private prisma: PrismaService,
    private readonly certificateIssuanceService: CertificateIssuanceService,
  ) {}

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

    // if (attachIds.length !== 1) {
    //   throw new BadRequestException(
    //     'Quiz must be attached to exactly ONE level',
    //   );
    // }

    const quiz = await this.prisma.quiz.create({
      data: {
        title,
        slug: await generateUniqueSlugForTable(this.prisma, 'quiz', title),
        timeLimit: timeLimit ?? 0,
        passMarks: passMarks ?? 0,
        totalMarks: totalMarks ?? 0,
        subMissionFrequency: createQuizDto.submissionFrequency,
        status: true,
        sortOrder: createQuizDto.sortOrder,
      },
    });

    if (courseId && !subjectId && !moduleId && !chapterId && !lessonId) {
      await this.prisma.courseQuiz.create({
        data: { courseId, quizId: quiz.id },
      });
    }
    if (subjectId && !moduleId && !chapterId && !lessonId) {
      await this.prisma.subjectQuiz.create({
        data: { subjectId, quizId: quiz.id },
      });
    }
    if (moduleId && !chapterId && !lessonId) {
      await this.prisma.moduleQuiz.create({
        data: { moduleId, quizId: quiz.id },
      });
    }
    if (chapterId && !lessonId) {
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

  async findAll(query: any, userId: number) {
    const {
      courseId,
      subjectId,
      moduleId,
      chapterId,
      lessonId,
      page = 1,
      limit = 20,
      keyword,
      search,
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

    const where: any = { status: true };
    const searchTerm = keyword || search;
    if (searchTerm) {
      where.title = {
        contains: searchTerm,
      };
    }

    if (courseId) where.courseQuizzes = { some: { courseId: +courseId } };
    if (subjectId) where.subjectQuizzes = { some: { subjectId: +subjectId } };
    if (moduleId) where.moduleQuizzes = { some: { moduleId: +moduleId } };
    if (chapterId) where.chapterQuizzes = { some: { chapterId: +chapterId } };
    if (lessonId) where.lessons = { some: { lessonId: +lessonId } };

    const quizzes = await this.prisma.quiz.findMany({
      where,
      include: {
        lessons: true,
        courseQuizzes: true,
        subjectQuizzes: true,
        moduleQuizzes: true,
        chapterQuizzes: true,
      },
      skip: (page - 1) * limit,
      take: +limit,
      orderBy: [{ sortOrder: 'asc' }],
    });

    const allSubjectIds = [
      ...new Set(
        quizzes.flatMap((q) => q.subjectQuizzes.map((s) => s.subjectId)),
      ),
    ];
    const allModuleIds = [
      ...new Set(
        quizzes.flatMap((q) => q.moduleQuizzes.map((m) => m.moduleId)),
      ),
    ];
    const allChapterIds = [
      ...new Set(
        quizzes.flatMap((q) => q.chapterQuizzes.map((c) => c.chapterId)),
      ),
    ];
    const allLessonIds = [
      ...new Set(quizzes.flatMap((q) => q.lessons.map((l) => l.lessonId))),
    ];

    const [subjects, modules, chapters, lessons] = await Promise.all([
      allSubjectIds.length
        ? this.prisma.courseSubject.findMany({
            where: { subjectId: { in: allSubjectIds } },
            select: { subjectId: true, courseId: true },
          })
        : [],

      allModuleIds.length
        ? this.prisma.module.findMany({
            where: { id: { in: allModuleIds } },
            select: {
              id: true,
              subject: { select: { courses: { select: { courseId: true } } } },
            },
          })
        : [],

      allChapterIds.length
        ? this.prisma.subjectChapter.findMany({
            where: { chapterId: { in: allChapterIds } },
            select: {
              chapterId: true,
              subject: { select: { courses: { select: { courseId: true } } } },
            },
          })
        : [],

      allLessonIds.length
        ? this.prisma.lessonToChapter.findMany({
            where: { lessonId: { in: allLessonIds } },
            select: {
              lessonId: true,
              chapter: {
                select: {
                  subjects: {
                    select: {
                      subject: {
                        select: { courses: { select: { courseId: true } } },
                      },
                    },
                  },
                },
              },
            },
          })
        : [],
    ]);

    const subjectCourseMap = new Map<number, Set<number>>();
    for (const row of subjects as { subjectId: number; courseId: number }[]) {
      if (!subjectCourseMap.has(row.subjectId))
        subjectCourseMap.set(row.subjectId, new Set());
      subjectCourseMap.get(row.subjectId)!.add(row.courseId);
    }
    const moduleCourseMap = new Map<number, Set<number>>();
    for (const mod of modules as any[]) {
      const ids = new Set<number>(
        mod.subject.courses.map((c: any) => c.courseId),
      );
      moduleCourseMap.set(mod.id, ids);
    }
    const chapterCourseMap = new Map<number, Set<number>>();
    for (const sc of chapters as any[]) {
      if (!chapterCourseMap.has(sc.chapterId))
        chapterCourseMap.set(sc.chapterId, new Set());
      for (const c of sc.subject.courses)
        chapterCourseMap.get(sc.chapterId)!.add(c.courseId);
    }
    const lessonCourseMap = new Map<number, Set<number>>();
    for (const ltc of lessons as any[]) {
      if (!lessonCourseMap.has(ltc.lessonId))
        lessonCourseMap.set(ltc.lessonId, new Set());
      for (const sc of ltc.chapter.subjects)
        for (const c of sc.subject.courses)
          lessonCourseMap.get(ltc.lessonId)!.add(c.courseId);
    }
    const quizCourseMap = new Map<number, Set<number>>();

    for (const quiz of quizzes) {
      const ids = new Set<number>();

      for (const cq of quiz.courseQuizzes) ids.add(cq.courseId);

      for (const sq of quiz.subjectQuizzes)
        subjectCourseMap.get(sq.subjectId)?.forEach((id) => ids.add(id));

      for (const mq of quiz.moduleQuizzes)
        moduleCourseMap.get(mq.moduleId)?.forEach((id) => ids.add(id));

      for (const chq of quiz.chapterQuizzes)
        chapterCourseMap.get(chq.chapterId)?.forEach((id) => ids.add(id));

      for (const lq of quiz.lessons)
        lessonCourseMap.get(lq.lessonId)?.forEach((id) => ids.add(id));

      quizCourseMap.set(quiz.id, ids);
    }
    const allCourseIds = [
      ...new Set([...quizCourseMap.values()].flatMap((s) => [...s])),
    ];

    const quizIds = quizzes.map((q) => q.id);

    const [enrollments, completedQuizzes] = await Promise.all([
      allCourseIds.length
        ? this.prisma.userEnrolledCourse.findMany({
            where: { userId, courseId: { in: allCourseIds } },
            select: { courseId: true },
          })
        : [],
      quizIds.length
        ? this.prisma.quizAttempt.findMany({
            where: { userId, quizId: { in: quizIds } },
            select: { quizId: true },
          })
        : [],
    ]);

    const institutionMembers = await this.prisma.institutionMember.findMany({
      where: {
        userId,
        status: true,
      },
      select: {
        institutionId: true,
      },
    });

    const institutionCourseAssignments = institutionMembers.length
      ? await this.prisma.institutionCourse.findMany({
          where: {
            institutionId: {
              in: institutionMembers.map((member) => member.institutionId),
            },
            courseId: { in: allCourseIds.length ? allCourseIds : [0] },
          },
          select: {
            courseId: true,
          },
        })
      : [];

    const enrolledSet = new Set([
      ...(enrollments as { courseId: number }[]).map((e) => e.courseId),
      ...(institutionCourseAssignments as { courseId: number }[]).map(
        (course) => course.courseId,
      ),
    ]);
    const completedSet = new Set(
      (completedQuizzes as { quizId: number }[]).map((c) => c.quizId),
    );
    const total = await this.prisma.quiz.count({
      where,
    });
    const data = quizzes.map((quiz) => {
      const quizCourseIds = quizCourseMap.get(quiz.id) ?? new Set<number>();
      const isUserEnrolled = [...quizCourseIds].some((id) =>
        enrolledSet.has(id),
      );

      return {
        id: quiz.id,
        title: quiz.title,
        slug: quiz.slug,
        totalMarks: quiz.totalMarks,
        passMarks: quiz.passMarks,
        timeLimit: quiz.timeLimit,
        status: quiz.status,
        createdAt: quiz.createdAt,
        updatedAt: quiz.updatedAt,
        courseId: quiz.courseQuizzes?.[0]?.courseId ?? null,
        subjectId: quiz.subjectQuizzes?.[0]?.subjectId ?? null,
        moduleId: quiz.moduleQuizzes?.[0]?.moduleId ?? null,
        chapterId: quiz.chapterQuizzes?.[0]?.chapterId ?? null,
        lessonId: quiz.lessons?.[0]?.lessonId ?? null,
        subMissionFrequency: quiz.subMissionFrequency,
        isUserEnrolled,
        isCompleted: completedSet.has(quiz.id),
        sortOrder: quiz.sortOrder,
      };
    });

    return {
      data,
      total,
      page: +page,
      limit: +limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const quiz = await this.prisma.quiz.findFirst({
      where: { id, status: true },
      include: {
        questions: {
          where: { status: true },
          include: {
            options: true,
          },
        },
        lessons: true,
        courseQuizzes: true,
        subjectQuizzes: true,
        moduleQuizzes: true,
        chapterQuizzes: true,
      },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    return {
      id: quiz.id,
      title: quiz.title,
      slug: quiz.slug,
      totalMarks: quiz.totalMarks,
      passMarks: quiz.passMarks,
      timeLimit: quiz.timeLimit,
      status: quiz.status,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt,

      courseId: quiz.courseQuizzes?.[0]?.courseId ?? null,
      subjectId: quiz.subjectQuizzes?.[0]?.subjectId ?? null,
      moduleId: quiz.moduleQuizzes?.[0]?.moduleId ?? null,
      chapterId: quiz.chapterQuizzes?.[0]?.chapterId ?? null,
      lessonId: quiz.lessons?.[0]?.lessonId ?? null,

      questions: quiz.questions,
    };
  }

  async findBySlug(slug: string, userId: number) {
    // Get user roles
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { roles: true },
    });

    const isPrivileged = user?.roles?.some(
      (r) => r.name === 'Super Admin' || r.name === 'TEACHER',
    );

    // Get quiz with all mappings (needed for enrollment logic)
    const quiz = await this.prisma.quiz.findFirst({
      where: { slug, status: true },
      include: {
        questions: {
          where: { status: true },
          select: {
            id: true,
            question: true,
            marks: true,
            duration: true,
            type: true,
            imageUrl: true,
            difficulty: true,
            options: {
              where: { status: true },
              select: {
                id: true,
                option: true,
                imageUrl: true,
              },
            },
          },
        },
        lessons: true,
        courseQuizzes: true,
        subjectQuizzes: true,
        moduleQuizzes: true,
        chapterQuizzes: true,
      },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // If privileged → skip enrollment check
    if (!isPrivileged) {
      const courseIds = new Set<number>();

      // Direct course
      quiz.courseQuizzes.forEach((cq) => courseIds.add(cq.courseId));

      // Subject → Course
      if (quiz.subjectQuizzes.length) {
        const subjects = await this.prisma.courseSubject.findMany({
          where: {
            subjectId: {
              in: quiz.subjectQuizzes.map((s) => s.subjectId),
            },
          },
          select: { courseId: true },
        });
        subjects.forEach((s) => courseIds.add(s.courseId));
      }

      // Module → Subject → Course
      if (quiz.moduleQuizzes.length) {
        const modules = await this.prisma.module.findMany({
          where: {
            id: { in: quiz.moduleQuizzes.map((m) => m.moduleId) },
          },
          select: {
            subject: {
              select: {
                courses: { select: { courseId: true } },
              },
            },
          },
        });

        modules.forEach((m) =>
          m.subject.courses.forEach((c) => courseIds.add(c.courseId)),
        );
      }

      // Chapter → Subject → Course
      if (quiz.chapterQuizzes.length) {
        const chapters = await this.prisma.subjectChapter.findMany({
          where: {
            chapterId: {
              in: quiz.chapterQuizzes.map((c) => c.chapterId),
            },
          },
          select: {
            subject: {
              select: {
                courses: { select: { courseId: true } },
              },
            },
          },
        });

        chapters.forEach((ch) =>
          ch.subject.courses.forEach((c) => courseIds.add(c.courseId)),
        );
      }

      // Lesson → Chapter → Subject → Course
      if (quiz.lessons.length) {
        const lessons = await this.prisma.lessonToChapter.findMany({
          where: {
            lessonId: { in: quiz.lessons.map((l) => l.lessonId) },
          },
          select: {
            chapter: {
              select: {
                subjects: {
                  select: {
                    subject: {
                      select: {
                        courses: { select: { courseId: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        });

        lessons.forEach((l) =>
          l.chapter.subjects.forEach((sc) =>
            sc.subject.courses.forEach((c) => courseIds.add(c.courseId)),
          ),
        );
      }

      // Check enrollment
      if (courseIds.size > 0) {
        const enrollment = await this.prisma.userEnrolledCourse.findFirst({
          where: {
            userId,
            courseId: { in: [...courseIds] },
          },
        });

        // if (!enrollment) {
        //   throw new ForbiddenException('You are not enrolled in this course');
        // }
      }
    }
    //append already attempted flag in quiz
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: {
        userId,
        quizId: quiz.id,
      },
    });

    (quiz as any).alreadyAttempted = !!attempt;

    return quiz;
  }

  async update(id: number, dto: UpdateQuizDto) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        courseQuizzes: true,
        subjectQuizzes: true,
        moduleQuizzes: true,
        chapterQuizzes: true,
        lessons: true,
      },
    });

    if (!quiz) throw new NotFoundException('Quiz not found');

    const slug = dto.title
      ? await generateUniqueSlugForTable(this.prisma, 'quiz', dto.title)
      : quiz.slug;

    // Update quiz basic fields
    const updatedQuiz = await this.prisma.quiz.update({
      where: { id },
      data: {
        title: dto.title ?? quiz.title,
        slug,
        timeLimit: dto.timeLimit ?? quiz.timeLimit,
        passMarks: dto.passMarks ?? quiz.passMarks,
        totalMarks: dto.totalMarks ?? quiz.totalMarks,
        sortOrder: dto.sortOrder ?? quiz.sortOrder,
        subMissionFrequency:
          dto.submissionFrequency ?? quiz.subMissionFrequency,
      },
    });

    // Handle relationship updates if provided
    const { courseId, subjectId, moduleId, chapterId, lessonId } = dto as any;

    if (
      courseId !== undefined ||
      subjectId !== undefined ||
      moduleId !== undefined ||
      chapterId !== undefined ||
      lessonId !== undefined
    ) {
      // Delete existing relationships
      await this.prisma.courseQuiz.deleteMany({ where: { quizId: id } });
      await this.prisma.subjectQuiz.deleteMany({ where: { quizId: id } });
      await this.prisma.moduleQuiz.deleteMany({ where: { quizId: id } });
      await this.prisma.chapterQuiz.deleteMany({ where: { quizId: id } });
      await this.prisma.lessonQuiz.deleteMany({ where: { quizId: id } });

      // Create new relationship
      if (courseId) {
        await this.prisma.courseQuiz.create({
          data: { courseId, quizId: id },
        });
      }
      if (subjectId) {
        await this.prisma.subjectQuiz.create({
          data: { subjectId, quizId: id },
        });
      }
      if (moduleId) {
        await this.prisma.moduleQuiz.create({
          data: { moduleId, quizId: id },
        });
      }
      if (chapterId) {
        await this.prisma.chapterQuiz.create({
          data: { chapterId, quizId: id },
        });
      }
      if (lessonId) {
        await this.prisma.lessonQuiz.create({
          data: { lessonId, quizId: id },
        });
      }
    }

    return updatedQuiz;
  }

  async updateStatus(id: number) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id } });
    if (!quiz) throw new NotFoundException('Quiz not found');

    return this.prisma.quiz.update({
      where: { id },
      data: { status: !quiz.status },
    });
  }

  async submitQuiz(userId: number, quizId: number, submitData: SubmitQuizDto) {
    const alreadyAttempted = await this.prisma.quizAttempt.findFirst({
      where: {
        quizId,
        userId,
      },
    });

    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: { include: { options: true } },
        lessons: true,
        courseQuizzes: true,
        subjectQuizzes: true,
        moduleQuizzes: true,
        chapterQuizzes: true,
      },
    });

    if (!quiz) throw new NotFoundException('Quiz not found');
    if (
      alreadyAttempted &&
      quiz.subMissionFrequency === QuizSubmissionFrequency.once
    ) {
      throw new BadRequestException('Quiz already attempted');
    }

    let obtainedMarks = 0;
    let correctAnswers = 0;

    const answers = submitData.answers.map((a) => {
      const q = quiz.questions.find((x) => x.id === a.questionId);

      if (!q) {
        throw new NotFoundException('Invalid question');
      }

      const result = this.gradeAnswer(q, a.answer);
      const correct = result.isCorrect;

      if (correct) {
        obtainedMarks += Number(q.marks);
        correctAnswers++;
      }

      // correct answer for response only
      let correctAnswer: any = null;

      if (q.type === 'MCQ' || q.type === 'TRUEORFALSE') {
        correctAnswer = q.options.find((o: any) => o.isCorrect)?.option ?? null;
      }

      if (q.type === 'FILLINTHEBLANK') {
        correctAnswer = q.answer ?? null;
      }

      return {
        // DB fields only
        questionId: q.id,
        obtainedMarks: correct ? Number(q.marks) : 0,
        totalMarks: Number(q.marks),
        isCorrect: correct,
        timeTaken: a.timeSpent ? Number(a.timeSpent) : 0,

        // extra response data only
        question: q.question,
        submittedAnswer: a.answer,
        correctAnswer,
      };
    });
    const totalMarks = quiz.questions.reduce(
      (sum, q) => sum + Number(q.marks),
      0,
    );
    const dbAnswers = answers.map((a) => ({
      questionId: a.questionId,
      obtainedMarks: a.obtainedMarks,
      totalMarks: a.totalMarks,
      isCorrect: a.isCorrect,
      timeTaken: a.timeTaken,
    }));
    const attempt = await this.prisma.quizAttempt.create({
      data: {
        quizId,
        userId,
        obtainedMarks,
        totalMarks,
        correctAnswers,
        totalQuestions: quiz.questions.length,
        timeTaken: submitData.timeTaken ?? 0,
        answers: { create: dbAnswers },
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

    const courseIds = await this.getCourseIdsForQuiz(quiz);
    await Promise.all(
      courseIds.map((courseId) =>
        this.certificateIssuanceService.checkAndIssueCourseCompletion(
          userId,
          courseId,
        ),
      ),
    );

    await this.certificateIssuanceService.issueQuizCertificateIfEligible(
      userId,
      quizId,
      attempt.id,
      obtainedMarks >= quiz.passMarks,
    );

    const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;
    return {
      attemptId: attempt.id,
      obtainedMarks,
      totalMarks,
      passMarks: quiz.passMarks,
      percentage: percentage,
      passed: obtainedMarks >= quiz.passMarks,
      answers,
      totalQuestions: quiz.questions.length,
      correctAnswers,
    };
  }

  private gradeAnswer(question: any, userAnswer: string | string[]) {
    if (question.type === 'MCQ' || question.type === 'TRUEORFALSE') {
      const correct = question.options.find((o: any) => o.isCorrect);
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

  private async getCourseIdsForQuiz(quiz: any): Promise<number[]> {
    const courseIds = new Set<number>();

    for (const cq of quiz.courseQuizzes ?? []) {
      courseIds.add(cq.courseId);
    }

    if (quiz.subjectQuizzes?.length) {
      const subjects = await this.prisma.courseSubject.findMany({
        where: {
          subjectId: {
            in: quiz.subjectQuizzes.map((s: any) => s.subjectId),
          },
        },
        select: { courseId: true },
      });

      subjects.forEach((subject) => courseIds.add(subject.courseId));
    }

    if (quiz.moduleQuizzes?.length) {
      const modules = await this.prisma.module.findMany({
        where: {
          id: { in: quiz.moduleQuizzes.map((m: any) => m.moduleId) },
        },
        select: {
          subject: {
            select: {
              courses: { select: { courseId: true } },
            },
          },
        },
      });

      modules.forEach((module) =>
        module.subject.courses.forEach((course: any) =>
          courseIds.add(course.courseId),
        ),
      );
    }

    if (quiz.chapterQuizzes?.length) {
      const chapters = await this.prisma.subjectChapter.findMany({
        where: {
          chapterId: { in: quiz.chapterQuizzes.map((c: any) => c.chapterId) },
        },
        select: {
          subject: {
            select: {
              courses: { select: { courseId: true } },
            },
          },
        },
      });

      chapters.forEach((chapter) =>
        chapter.subject.courses.forEach((course: any) =>
          courseIds.add(course.courseId),
        ),
      );
    }

    if (quiz.lessons?.length) {
      const lessons = await this.prisma.lessonToChapter.findMany({
        where: {
          lessonId: { in: quiz.lessons.map((l: any) => l.lessonId) },
        },
        select: {
          chapter: {
            select: {
              subjects: {
                select: {
                  subject: {
                    select: {
                      courses: { select: { courseId: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      lessons.forEach((lesson) =>
        lesson.chapter.subjects.forEach((subject: any) =>
          subject.subject.courses.forEach((course: any) =>
            courseIds.add(course.courseId),
          ),
        ),
      );
    }

    return [...courseIds];
  }

  async createQuizAndAttach(
    tx: any,
    quizData: {
      title: string;
      timeLimit?: number;
      passMarks?: number;
      totalMarks?: number;
      sortOrder?: number;
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
        slug: await generateUniqueSlugForTable(
          this.prisma,
          'quiz',
          quizData.title,
        ),
        timeLimit: quizData.timeLimit ?? 0,
        passMarks: quizData.passMarks ?? 0,
        totalMarks: quizData.totalMarks ?? 0,
        sortOrder: quizData.sortOrder ?? 0,
        submissionFrequency: QuizSubmissionFrequency.once,
        status: true,
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

  async remove(id: number) {
    const quiz = await this.prisma.quiz.findFirst({
      where: {
        id,
        status: true,
      },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    return this.prisma.quiz.update({
      where: { id },
      data: {
        status: false,
      },
    });
  }

  async toggleLock(id: number) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    return this.prisma.quiz.update({
      where: { id },
      data: {
        isLocked: !quiz.isLocked,
      },
    });
  }
}
