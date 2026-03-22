import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateSubmissionDto,
  UpdateSubmissionDto,
  QuerySubmissionsDto,
} from './dto/submission.dto';
import { SubmissionStatus, SubmissionType } from '../../generated/prisma/enums';
import { UploadService } from 'src/upload/upload.service';
@Injectable()
export class ProjectSubmissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  private async getProjectOrThrow(projectId: number) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException(`Project not found`);
    return project;
  }

  private async getSubmissionOrThrow(id: number) {
    const sub = await this.prisma.projectSubmission.findUnique({
      where: { id },
      include: { files: true, grade: true, project: true },
    });
    if (!sub) throw new NotFoundException(`Submission not found`);
    return sub;
  }

  private isDeadlinePassed(deadline: Date): boolean {
    return new Date() > deadline;
  }

  private determineStatus(
    project: { deadline: Date; allowLate: boolean },
    existingVersion: number,
  ): SubmissionStatus {
    const late = this.isDeadlinePassed(project.deadline);
    if (late && !project.allowLate) {
      throw new BadRequestException('Submission deadline has passed');
    }
    if (existingVersion > 0) return SubmissionStatus.re_submitted;
    return late ? SubmissionStatus.late_submitted : SubmissionStatus.submitted;
  }

  async createOrResubmit(
    dto: CreateSubmissionDto,
    studentId: number,
    files?: Express.Multer.File[],
  ) {
    const project = await this.getProjectOrThrow(dto.projectId);

    // Find existing submission for upsert
    const existing = await this.prisma.projectSubmission.findUnique({
      where: {
        projectId_studentId: { projectId: dto.projectId, studentId },
      },
      include: { files: true },
    });

    // If already graded, no more submissions
    if (existing?.status === SubmissionStatus.graded) {
      throw new BadRequestException(
        'This submission has already been evaluated',
      );
    }

    const nextVersion = existing ? existing.version + 1 : 1;
    const newStatus = this.determineStatus(
      project,
      existing ? existing.version : 0,
    );

    return this.prisma.$transaction(async (tx) => {
      let submission: any;

      if (existing) {
        // Snapshot history before update
        await tx.submissionHistory.create({
          data: {
            submissionId: existing.id,
            version: existing.version,
            status: existing.status,
            description: existing.description ?? undefined,
          },
        });

        submission = await tx.projectSubmission.update({
          where: { id: existing.id },
          data: {
            status: newStatus,
            description: dto.description,
            version: nextVersion,
            submittedAt: new Date(),
          },
        });
      } else {
        submission = await tx.projectSubmission.create({
          data: {
            projectId: dto.projectId,
            studentId,
            status: newStatus,
            description: dto.description,
            version: nextVersion,
            submittedAt: new Date(),
          },
        });
      }

      // Attach uploaded files
      if (files?.length) {
        const uploadedFiles = await Promise.all(
          files.map((f) =>
            this.uploadService.uploadFile(
              f,
              this.mimeToSubmissionType(f.mimetype),
            ),
          ),
        );

        await tx.submissionFile.createMany({
          data: uploadedFiles.map((res, i) => ({
            submissionId: submission.id,
            fileType: this.mimeToSubmissionType(files[i].mimetype),
            fileUrl: res.url,
            originalName: res.filename,
            fileSizeKb: Math.round(files[i].size / 1024),
            version: nextVersion,
          })),
        });
      }

      // Attach external links
      if (dto.links?.length) {
        await tx.submissionFile.createMany({
          data: dto.links.map((l) => ({
            submissionId: submission.id,
            fileType: l.fileType,
            fileUrl: l.fileUrl,
            version: nextVersion,
          })),
        });
      }

      return tx.projectSubmission.findUnique({
        where: { id: submission.id },
        include: { files: true },
      });
    });
  }

  private mimeToSubmissionType(mime: string): SubmissionType {
    if (mime === 'application/pdf') return SubmissionType.pdf;
    if (mime.startsWith('image/')) return SubmissionType.image;
    if (mime.startsWith('video/')) return SubmissionType.video;
    return SubmissionType.pdf;
  }

  async updateSubmission(
    id: number,
    dto: UpdateSubmissionDto,
    studentId: number,
    files?: Express.Multer.File[],
  ) {
    const submission = await this.getSubmissionOrThrow(id);

    if (submission.studentId !== studentId) {
      throw new ForbiddenException('Access denied');
    }
    if (submission.status === SubmissionStatus.graded) {
      throw new BadRequestException('Graded submissions cannot be edited');
    }
    if (
      this.isDeadlinePassed(submission.project.deadline) &&
      !submission.project.allowLate
    ) {
      throw new BadRequestException('Cannot edit after deadline');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.projectSubmission.update({
        where: { id },
        data: { description: dto.description },
      });

      // Add new files if provided
      if (files?.length) {
        const uploadedFiles = await Promise.all(
          files.map((f) =>
            this.uploadService.uploadFile(
              f,
              this.mimeToSubmissionType(f.mimetype),
            ),
          ),
        );

        await tx.submissionFile.createMany({
          data: uploadedFiles.map((res, i) => ({
            submissionId: id,
            fileType: this.mimeToSubmissionType(files[i].mimetype),
            fileUrl: res.url,
            originalName: res.filename,
            fileSizeKb: Math.round(files[i].size / 1024),
            version: submission.version,
          })),
        });
      }

      if (dto.links?.length) {
        await tx.submissionFile.createMany({
          data: dto.links.map((l) => ({
            submissionId: id,
            fileType: l.fileType,
            fileUrl: l.fileUrl,
            version: submission.version,
          })),
        });
      }

      return tx.projectSubmission.findUnique({
        where: { id },
        include: { files: true },
      });
    });
  }

  async removeFile(submissionId: number, fileId: number, studentId: number) {
    const submission = await this.getSubmissionOrThrow(submissionId);
    if (submission.studentId !== studentId)
      throw new ForbiddenException('Access denied');
    if (submission.status === SubmissionStatus.graded) {
      throw new BadRequestException(
        'Cannot remove files from graded submission',
      );
    }
    await this.prisma.submissionFile.delete({ where: { id: fileId } });
    return { fileId };
  }

  async findAll(query: QuerySubmissionsDto) {
    const { page = 1, limit = 10, projectId, studentId, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (studentId) where.studentId = studentId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.projectSubmission.findMany({
        where,
        skip,
        take: limit,
        include: {
          files: true,
          grade: true,
          student: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          project: {
            select: { id: true, title: true, maxMarks: true, deadline: true },
          },
        },
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.projectSubmission.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: number) {
    return this.getSubmissionOrThrow(id);
  }

  async findMySubmission(projectId: number, studentId: number) {
    const sub = await this.prisma.projectSubmission.findUnique({
      where: { projectId_studentId: { projectId, studentId } },
      include: { files: true, grade: true, history: true },
    });
    if (!sub)
      throw new NotFoundException('You have not submitted for this project');
    return sub;
  }

  async markUnderReview(submissionId: number) {
    return this.prisma.projectSubmission.update({
      where: { id: submissionId },
      data: { status: SubmissionStatus.under_review },
    });
  }

  async getHistory(submissionId: number) {
    return this.prisma.submissionHistory.findMany({
      where: { submissionId },
      orderBy: { version: 'asc' },
    });
  }
}
