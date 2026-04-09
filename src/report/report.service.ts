import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

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
    const quizIds = await this.getAllCourseQuizIds(course.id);
    return {
      courseId: course.id,
      totalQuizzes: quizIds.length,
      quizIds,
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
}
