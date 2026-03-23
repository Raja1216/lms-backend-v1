import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ManualGradeDto, RubricGradeDto } from './dto/grading.dto';
import {
  calcPercentage,
  calcLetterGrade,
  calcRubricTotal,
  GradeBand,
} from '../../utils/grade-calculator.util';
import {
  GradingMethod,
  SubmissionStatus,
  LetterGrade,
} from '../../generated/prisma/enums';
@Injectable()
export class ProjectGradingService {
  constructor(private readonly prisma: PrismaService) {}
  private async getSubmissionOrThrow(submissionId: number) {
    const sub = await this.prisma.projectSubmission.findUnique({
      where: { id: submissionId },
      include: {
        project: { include: { rubrics: true } },
        grade: { include: { rubricGrades: true } },
      },
    });
    if (!sub) {
      throw new NotFoundException(`Submission not found`);
    }
    return sub;
  }

  private async resolveBands(courseId: number): Promise<GradeBand[]> {
    const scale = await this.prisma.gradeScale.findUnique({
      where: { courseId },
      include: { bands: true },
    });
    if (!scale) return []; // fall back to defaults in util
    return scale.bands.map((b) => ({
      minPercent: Number(b.minPercent),
      maxPercent: Number(b.maxPercent),
      letterGrade: b.letterGrade,
    }));
  }

  async gradeManual(
    submissionId: number,
    dto: ManualGradeDto,
    teacherId: number,
  ) {
    const submission = await this.getSubmissionOrThrow(submissionId);
    const project = submission.project;

    if (project.gradingMethod !== GradingMethod.manual) {
      throw new BadRequestException(
        'This project uses rubric grading. Use the rubric method.',
      );
    }
    if (dto.obtainedMarks > project.maxMarks) {
      throw new BadRequestException(
        `Marks cannot exceed max marks (${project.maxMarks})`,
      );
    }

    const percentage = calcPercentage(dto.obtainedMarks, project.maxMarks);
    const bands = await this.resolveBands(project.courseId);
    const letterGrade = calcLetterGrade(
      percentage,
      bands.length ? bands : undefined,
    );

    return this.prisma.$transaction(async (tx) => {
      // Upsert grade (supports re-grading)
      const grade = await tx.projectGrade.upsert({
        where: { submissionId },
        create: {
          submissionId,
          teacherId,
          obtainedMarks: dto.obtainedMarks,
          totalMarks: project.maxMarks,
          percentage,
          letterGrade,
          feedback: dto.feedback,
          isPublished: false,
        },
        update: {
          teacherId,
          obtainedMarks: dto.obtainedMarks,
          totalMarks: project.maxMarks,
          percentage,
          letterGrade,
          feedback: dto.feedback,
          gradedAt: new Date(),
        },
      });

      // Update submission status → graded
      await tx.projectSubmission.update({
        where: { id: submissionId },
        data: { status: SubmissionStatus.graded },
      });

      return grade;
    });
  }

  async gradeRubric(
    submissionId: number,
    dto: RubricGradeDto,
    teacherId: number,
  ) {
    const submission = await this.getSubmissionOrThrow(submissionId);
    const project = submission.project;

    if (project.gradingMethod !== GradingMethod.rubric) {
      throw new BadRequestException(
        'This project uses manual grading. Use the manual method.',
      );
    }

    // Validate all rubrics belong to the project
    const projectRubricIds = project.rubrics.map((r) => r.id);
    for (const criterion of dto.criteria) {
      if (!projectRubricIds.includes(criterion.rubricId)) {
        throw new BadRequestException(`Rubric does not belong to this project`);
      }
    }

    // Validate marks don't exceed per-rubric maxMarks
    for (const criterion of dto.criteria) {
      const rubric = project.rubrics.find((r) => r.id === criterion.rubricId)!;
      if (criterion.marks > rubric.maxMarks) {
        throw new BadRequestException(
          `Marks for rubric "${rubric.title}" exceed its maxMarks (${rubric.maxMarks})`,
        );
      }
    }

    // Calculate weighted total
    const rubricItems = dto.criteria.map((c) => {
      const rubric = project.rubrics.find((r) => r.id === c.rubricId)!;
      return {
        weight: Number(rubric.weight),
        marks: c.marks,
        maxMarks: rubric.maxMarks,
      };
    });

    const obtainedMarks = calcRubricTotal(rubricItems, project.maxMarks);
    const percentage = calcPercentage(obtainedMarks, project.maxMarks);
    const bands = await this.resolveBands(project.courseId);
    const letterGrade = calcLetterGrade(
      percentage,
      bands.length ? bands : undefined,
    );

    return this.prisma.$transaction(async (tx) => {
      // Upsert grade header
      const grade = await tx.projectGrade.upsert({
        where: { submissionId },
        create: {
          submissionId,
          teacherId,
          obtainedMarks,
          totalMarks: project.maxMarks,
          percentage,
          letterGrade,
          feedback: dto.feedback,
          isPublished: false,
        },
        update: {
          teacherId,
          obtainedMarks,
          totalMarks: project.maxMarks,
          percentage,
          letterGrade,
          feedback: dto.feedback,
          gradedAt: new Date(),
        },
      });

      // Replace rubric criterion grades
      await tx.rubricGrade.deleteMany({ where: { gradeId: grade.id } });
      await tx.rubricGrade.createMany({
        data: dto.criteria.map((c) => ({
          gradeId: grade.id,
          rubricId: c.rubricId,
          marks: c.marks,
          comment: c.comment,
        })),
      });

      // Update submission status
      await tx.projectSubmission.update({
        where: { id: submissionId },
        data: { status: SubmissionStatus.graded },
      });

      return tx.projectGrade.findUnique({
        where: { id: grade.id },
        include: { rubricGrades: { include: { rubric: true } } },
      });
    });
  }

  async publishGrade(submissionId: number, userId: number) {
    const grade = await this.prisma.projectGrade.findUnique({
      where: { submissionId },
    });
    const userRoles = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { roles: true },
    });
    if (!grade)
      throw new NotFoundException('Grade not found for this submission');
    if (
      grade.teacherId !== userId &&
      !userRoles?.roles?.some((role) => role.name === 'Super Admin')
    ) {
      throw new ForbiddenException(
        'Only the grading teacher can publish this grade',
      );
    }
    return this.prisma.projectGrade.update({
      where: { submissionId },
      data: { isPublished: true },
    });
  }
  async getGrade(submissionId: number) {
    const grade = await this.prisma.projectGrade.findUnique({
      where: { submissionId },
      include: {
        rubricGrades: { include: { rubric: true } },
        teacher: { select: { id: true, name: true } },
        submission: {
          include: {
            student: { select: { id: true, name: true, email: true } },
            project: { select: { id: true, title: true, maxMarks: true } },
          },
        },
      },
    });
    if (!grade) throw new NotFoundException('Grade not found');
    return grade;
  }
  async getMyGrade(submissionId: number, studentId: number) {
    const submission = await this.prisma.projectSubmission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }
    if (submission.studentId !== studentId) {
      throw new ForbiddenException('Access denied');
    }
    const grade = await this.prisma.projectGrade.findUnique({
      where: { submissionId },
      include: {
        rubricGrades: { include: { rubric: true } },
        submission: {
          include: { project: { select: { title: true, maxMarks: true } } },
        },
      },
    });
    if (!grade) {
      throw new NotFoundException('Grade not available yet');
    }
    if (!grade.isPublished) {
      throw new ForbiddenException('Your grade has not been published yet');
    }
    return grade;
  }

  async getCoursePerformance(courseId: number, studentId: number) {
    // All projects in this course
    const projects = await this.prisma.project.findMany({
      where: { courseId, status: true },
      include: {
        submissions: {
          where: { studentId },
          include: { grade: true },
        },
      },
    });

    // All quiz attempts for quizzes attached to this course
    const courseQuizzes = await this.prisma.courseQuiz.findMany({
      where: { courseId },
      include: {
        quiz: {
          include: {
            quizAttempts: {
              where: { userId: studentId },
              orderBy: { createdAt: 'desc' },
              take: 1, // best/latest attempt
            },
          },
        },
      },
    });
    let totalProjectWeight = 0;
    let weightedProjectScore = 0;

    const projectBreakdown = projects.map((p) => {
      const submission = p.submissions[0];
      const grade = submission?.grade;
      const weight = Number(p.weightPercent);
      totalProjectWeight += weight;

      let score = 0;
      if (grade) {
        score = Number(grade.percentage);
        weightedProjectScore += (score * weight) / 100;
      }
      return {
        projectId: p.id,
        title: p.title,
        maxMarks: p.maxMarks,
        weightPercent: weight,
        obtainedMarks: grade ? Number(grade.obtainedMarks) : null,
        percentage: grade ? Number(grade.percentage) : null,
        letterGrade: grade?.letterGrade ?? null,
        status: submission?.status ?? 'not_submitted',
        isPublished: grade?.isPublished ?? false,
      };
    });
    let totalQuizWeight = Math.max(0, 100 - totalProjectWeight);
    let weightedQuizScore = 0;
    const quizCount = courseQuizzes.length;

    const quizBreakdown = courseQuizzes.map((cq) => {
      const attempt = cq.quiz.quizAttempts[0];
      const percentage = attempt
        ? calcPercentage(
            Number(attempt.obtainedMarks),
            Number(attempt.totalMarks),
          )
        : null;

      if (percentage !== null && quizCount > 0) {
        weightedQuizScore += (percentage * (totalQuizWeight / quizCount)) / 100;
      }

      return {
        quizId: cq.quiz.id,
        title: cq.quiz.title,
        obtainedMarks: attempt ? Number(attempt.obtainedMarks) : null,
        totalMarks: attempt ? Number(attempt.totalMarks) : null,
        percentage,
        attempted: !!attempt,
      };
    });

    const finalScore = weightedProjectScore + weightedQuizScore;
    const bands = await this.resolveBands(courseId);
    const finalGrade = calcLetterGrade(
      finalScore,
      bands.length ? bands : undefined,
    );

    return {
      courseId,
      studentId,
      projectBreakdown,
      quizBreakdown,
      summary: {
        projectWeightTotal: totalProjectWeight,
        quizWeightTotal: totalQuizWeight,
        weightedProjectScore: Math.round(weightedProjectScore * 100) / 100,
        weightedQuizScore: Math.round(weightedQuizScore * 100) / 100,
        finalScore: Math.round(finalScore * 100) / 100,
        finalGrade,
      },
    };
  }
  async listGradesByProject(projectId: number) {
    return this.prisma.projectGrade.findMany({
      where: { submission: { projectId } },
      include: {
        submission: {
          include: {
            student: { select: { id: true, name: true, email: true } },
          },
        },
        rubricGrades: { include: { rubric: true } },
      },
      orderBy: { gradedAt: 'desc' },
    });
  }
}
