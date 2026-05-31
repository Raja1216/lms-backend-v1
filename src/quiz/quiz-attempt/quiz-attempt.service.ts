import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import { QuizAttemptsFilterDto } from './dto/quiz-attempts-filter.dto';
@Injectable()
export class QuizAttemptService {
  constructor(private readonly prisma: PrismaService) {}
  private buildWhere(dto: QuizAttemptsFilterDto) {
    const { keyword, courseId, subjectId, moduleId, chapterId, quizId, grade } =
      dto;

    const where: any = {};

    // Filter by specific quiz
    if (quizId) {
      where.quizId = quizId;
    }

    // Filter by course (via CourseQuiz join)
    if (courseId && !quizId) {
      where.quiz = {
        ...where.quiz,
        courseQuizzes: { some: { courseId } },
      };
    }

    // Filter by subject (via SubjectQuiz join)
    if (subjectId && !quizId) {
      where.quiz = {
        ...where.quiz,
        subjectQuizzes: { some: { subjectId } },
      };
    }

    // Filter by module (via ModuleQuiz join)
    if (moduleId && !quizId) {
      where.quiz = {
        ...where.quiz,
        moduleQuizzes: { some: { moduleId } },
      };
    }

    // Filter by chapter (via ChapterQuiz join)
    if (chapterId && !quizId) {
      where.quiz = {
        ...where.quiz,
        chapterQuizzes: { some: { chapterId } },
      };
    }

    // Filter by user's class grade
    if (grade) {
      where.user = { classGrade: grade };
    }

    // Keyword search on user name, email, or mobile
    if (keyword) {
      where.user = {
        ...where.user,
        OR: [
          { name: { contains: keyword } },
          { email: { contains: keyword } },
          { mobile: { contains: keyword } },
          { schoolName: { contains: keyword } },
        ],
      };
    }

    return where;
  }
  async findAll(dto: QuizAttemptsFilterDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;
    const skip = (page - 1) * limit;

    const where = this.buildWhere(dto);

    const [data, total] = await Promise.all([
      this.prisma.quizAttempt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              mobile: true,
              schoolName: true,
              classGrade: true,
              section: true,
              rollNo: true,
            },
          },
          quiz: {
            select: {
              id: true,
              title: true,
              totalMarks: true,
              passMarks: true,
            },
          },
        },
      }),
      this.prisma.quizAttempt.count({ where }),
    ]);

    const rows = data.map((attempt) => this.formatAttempt(attempt));
    return { rows, page, limit, total };
  }
  async exportAttempts(dto: QuizAttemptsFilterDto, format: 'xlsx' | 'csv') {
    const where = this.buildWhere(dto);

    const data = await this.prisma.quizAttempt.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            mobile: true,
            schoolName: true,
            classGrade: true,
            section: true,
            rollNo: true,
          },
        },
        quiz: {
          select: { title: true, totalMarks: true, passMarks: true },
        },
      },
    });

    const rows = data.map((a) => this.formatAttempt(a));

    if (format === 'csv') {
      return this.buildCsv(rows);
    }
    return this.buildXlsx(rows);
  }
  private async buildXlsx(rows: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Quiz Attempts');

    const COLUMNS = [
      { header: 'User Name', key: 'userName', width: 22 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Mobile', key: 'mobile', width: 16 },
      { header: 'School Name', key: 'schoolName', width: 28 },
      { header: 'Class', key: 'className', width: 10 },
      { header: 'Section', key: 'section', width: 10 },
      { header: 'Roll No', key: 'rollNo', width: 12 },
      { header: 'Quiz Title', key: 'quizTitle', width: 28 },
      { header: 'Obtained Marks', key: 'obtainedMarks', width: 16 },
      { header: 'Total Marks', key: 'totalMarks', width: 14 },
      { header: 'Correct Answers', key: 'correctAnswers', width: 16 },
      { header: 'Total Questions', key: 'totalQuestions', width: 16 },
      { header: 'Time Taken (s)', key: 'timeTaken', width: 16 },
      { header: 'Percentage (%)', key: 'percentage', width: 16 },
      { header: 'Passed', key: 'passed', width: 10 },
      { header: 'Attempted At', key: 'attemptedAt', width: 22 },
    ];

    sheet.columns = COLUMNS;

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 22;

    rows.forEach((r) => {
      const row = sheet.addRow({
        ...r,
        passed: r.passed ? 'Yes' : 'No',
        attemptedAt: new Date(r.attemptedAt).toLocaleString(),
      });
      row.alignment = { vertical: 'middle' };
    });

    // Alternating row colors
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F3FF' },
          };
        });
      }
    });

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  private buildCsv(rows: any[]): string {
    const headers = [
      'user_name',
      'email',
      'mobile',
      'school_name',
      'class_name',
      'section',
      'roll_no',
      'quiz_title',
      'obtainedMarks',
      'totalMarks',
      'correctAnswers',
      'totalQuestions',
      'timeTaken',
      'percentage',
      'passed',
      'attemptedAt',
    ];

    const escape = (v: any) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const lines = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r.userName,
          r.email,
          r.mobile,
          r.schoolName,
          r.className,
          r.section,
          r.rollNo,
          r.quizTitle,
          r.obtainedMarks,
          r.totalMarks,
          r.correctAnswers,
          r.totalQuestions,
          r.timeTaken,
          r.percentage,
          r.passed ? 'Yes' : 'No',
          new Date(r.attemptedAt).toISOString(),
        ]
          .map(escape)
          .join(','),
      ),
    ];

    return lines.join('\n');
  }
  private formatAttempt(attempt: any) {
    const percentage =
      attempt.totalMarks > 0
        ? (
            (Number(attempt.obtainedMarks) / Number(attempt.totalMarks)) *
            100
          ).toFixed(1)
        : '0';

    return {
      id: attempt.id,
      userId: attempt.userId,
      quizId: attempt.quizId,
      quizTitle: attempt.quiz?.title ?? '',
      userName: attempt.user?.name ?? '',
      email: attempt.user?.email ?? '',
      mobile: attempt.user?.mobile ?? '',
      schoolName: attempt.user?.schoolName ?? '',
      className: attempt.user?.classGrade ?? '',
      section: attempt.user?.section ?? '',
      rollNo: attempt.user?.rollNo ?? '',
      obtainedMarks: Number(attempt.obtainedMarks),
      totalMarks: Number(attempt.totalMarks),
      correctAnswers: attempt.correctAnswers,
      totalQuestions: attempt.totalQuestions,
      timeTaken: attempt.timeTaken,
      percentage: Number(percentage),
      passed: Number(attempt.obtainedMarks) >= (attempt.quiz?.passMarks ?? 0),
      attemptedAt: attempt.createdAt,
    };
  }
}
