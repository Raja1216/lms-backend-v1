import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCertificateDto } from './dto/create-certificate.dto';

@Injectable()
export class CertificateService {
  constructor(private prisma: PrismaService) {}

  async generateCertificateNumber() {
    const timestamp = Date.now();
    const random = Math.floor(1000 + Math.random() * 9000);

    return `CERT-${new Date().getFullYear()}-${timestamp}-${random}`;
  }

  async create(dto: CreateCertificateDto) {
    const certificateNumber = await this.generateCertificateNumber();

    return this.prisma.certificate.create({
      data: {
        ...dto,
        certificateNumber,
      },
    });
  }

  async getMyCertificates(userId: number) {
    return this.prisma.certificate.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: number) {
    return this.prisma.certificate.findUnique({
      where: { id },
    });
  }

  async verify(certificateNumber: string) {
    return this.prisma.certificate.findUnique({
      where: { certificateNumber },
    });
  }

  // 🔥 MAIN LOGIC: Generate after project grading
  async generateFromProjectSubmission(submissionId: number) {
    const submission = await this.prisma.projectSubmission.findUnique({
      where: { id: submissionId },
      include: {
        student: true,
        project: {
          include: {
            course: true,
          },
        },
        grade: true,
      },
    });

    if (!submission || !submission.grade || !submission.grade.isPublished) {
      return null;
    }

    return this.create({
      userId: submission.studentId,
      type: 'project_completion',
      title: 'Certificate of Completion',
      studentName: submission.student.name || '',
      className: submission.student.classGrade || '',
      projectTitle: submission.project.title,
      courseName: submission.project.course.title,
      grade: submission.grade.letterGrade || '',
      teacherRemarks: submission.grade.feedback ?? undefined,
      completionDate: new Date(),
      brandLogo: 'stempowered',
    });
  }
}
