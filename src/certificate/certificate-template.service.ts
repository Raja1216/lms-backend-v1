import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CertificateGeneratorService } from '../services/certicate-generator/certicate-generator.service';
import {
  CreateCertificateTemplateDto,
  UpdateCertificateTemplateDto,
  PreviewCertificateTemplateDto,
  AssignCourseTemplateDto,
} from './dto/certificate-template.dto';

@Injectable()
export class CertificateTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly certGenerator: CertificateGeneratorService,
  ) {}

  async getAllTemplates(query?: any) {
    const page = Number(query?.page) > 0 ? Number(query.page) : 1;
    const limit = Number(query?.limit) > 0 ? Number(query.limit) : 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query?.keyword && typeof query.keyword === 'string' && query.keyword.trim()) {
      const kw = query.keyword.trim();
      where.OR = [
        { title: { contains: kw } },
        { description: { contains: kw } },
        { headerText: { contains: kw } },
      ];
    }

    if (query?.type && query.type !== 'all') {
      where.type = query.type;
    }

    if (query?.status !== undefined && query?.status !== '') {
      where.status =
        typeof query.status === 'string'
          ? query.status === 'true'
          : Boolean(query.status);
    }

    if (query?.courseId) {
      where.courseId = Number(query.courseId);
    }

    const [data, total] = await Promise.all([
      this.prisma.certificateTemplate.findMany({
        where,
        include: {
          course: { select: { id: true, title: true, slug: true } },
          institution: { select: { id: true, name: true, slug: true } },
        },
        skip,
        take: limit,
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      }),
      this.prisma.certificateTemplate.count({ where }),
    ]);

    return { data, total, page, limit };
  }


  async getTemplateById(id: number) {
    const template = await this.prisma.certificateTemplate.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, title: true, slug: true } },
        institution: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!template) {
      throw new NotFoundException(`Certificate template #${id} not found`);
    }
    return template;
  }

  async createTemplate(dto: CreateCertificateTemplateDto) {
    // If set to default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.certificateTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    return await this.prisma.certificateTemplate.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type || 'course',
        backgroundUrl: dto.backgroundUrl,
        logoUrl: dto.logoUrl,
        secondaryLogoUrl: dto.secondaryLogoUrl,
        signatureUrl: dto.signatureUrl,
        signatoryName: dto.signatoryName,
        signatoryTitle: dto.signatoryTitle,
        primaryColor: dto.primaryColor || '#7a00ff',
        secondaryColor: dto.secondaryColor || '#ff5a00',
        textColor: dto.textColor || '#1f2937',
        fontFamily: dto.fontFamily,
        headerText: dto.headerText || 'CERTIFICATE OF COMPLETION',
        subHeaderText: dto.subHeaderText || 'PROUDLY PRESENTED TO',
        bodyText: dto.bodyText,
        footerText: dto.footerText,
        showQrCode: dto.showQrCode ?? true,
        showGrade: dto.showGrade ?? true,
        showScore: dto.showScore ?? true,
        showIssueDate: dto.showIssueDate ?? true,
        showCertificateId: dto.showCertificateId ?? true,
        customHtml: dto.customHtml,
        courseId: dto.courseId,
        institutionId: dto.institutionId,
        isDefault: dto.isDefault ?? false,
        status: dto.status ?? true,
      },
      include: {
        course: { select: { id: true, title: true, slug: true } },
        institution: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async updateTemplate(id: number, dto: UpdateCertificateTemplateDto) {
    const existing = await this.prisma.certificateTemplate.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Certificate template #${id} not found`);
    }

    if (dto.isDefault) {
      await this.prisma.certificateTemplate.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return await this.prisma.certificateTemplate.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.backgroundUrl !== undefined && { backgroundUrl: dto.backgroundUrl }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.secondaryLogoUrl !== undefined && { secondaryLogoUrl: dto.secondaryLogoUrl }),
        ...(dto.signatureUrl !== undefined && { signatureUrl: dto.signatureUrl }),
        ...(dto.signatoryName !== undefined && { signatoryName: dto.signatoryName }),
        ...(dto.signatoryTitle !== undefined && { signatoryTitle: dto.signatoryTitle }),
        ...(dto.primaryColor !== undefined && { primaryColor: dto.primaryColor }),
        ...(dto.secondaryColor !== undefined && { secondaryColor: dto.secondaryColor }),
        ...(dto.textColor !== undefined && { textColor: dto.textColor }),
        ...(dto.fontFamily !== undefined && { fontFamily: dto.fontFamily }),
        ...(dto.headerText !== undefined && { headerText: dto.headerText }),
        ...(dto.subHeaderText !== undefined && { subHeaderText: dto.subHeaderText }),
        ...(dto.bodyText !== undefined && { bodyText: dto.bodyText }),
        ...(dto.footerText !== undefined && { footerText: dto.footerText }),
        ...(dto.showQrCode !== undefined && { showQrCode: dto.showQrCode }),
        ...(dto.showGrade !== undefined && { showGrade: dto.showGrade }),
        ...(dto.showScore !== undefined && { showScore: dto.showScore }),
        ...(dto.showIssueDate !== undefined && { showIssueDate: dto.showIssueDate }),
        ...(dto.showCertificateId !== undefined && { showCertificateId: dto.showCertificateId }),
        ...(dto.customHtml !== undefined && { customHtml: dto.customHtml }),
        ...(dto.courseId !== undefined && { courseId: dto.courseId }),
        ...(dto.institutionId !== undefined && { institutionId: dto.institutionId }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: {
        course: { select: { id: true, title: true, slug: true } },
        institution: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async deleteTemplate(id: number) {
    const existing = await this.prisma.certificateTemplate.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Certificate template #${id} not found`);
    }

    await this.prisma.certificateTemplate.delete({
      where: { id },
    });

    return { success: true, message: 'Certificate template deleted successfully' };
  }

  async setDefaultTemplate(id: number) {
    const existing = await this.prisma.certificateTemplate.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Certificate template #${id} not found`);
    }

    await this.prisma.$transaction([
      this.prisma.certificateTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.certificateTemplate.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    return { success: true, message: 'Default certificate template updated' };
  }

  async assignCourseTemplate(dto: AssignCourseTemplateDto) {
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (dto.templateId) {
      const template = await this.prisma.certificateTemplate.findUnique({
        where: { id: dto.templateId },
      });
      if (!template) {
        throw new NotFoundException('Certificate template not found');
      }

      await this.prisma.certificateTemplate.update({
        where: { id: dto.templateId },
        data: { courseId: dto.courseId },
      });
    } else {
      await this.prisma.certificateTemplate.updateMany({
        where: { courseId: dto.courseId },
        data: { courseId: null },
      });
    }

    return { success: true, message: 'Course certificate template assignment updated' };
  }

  async previewTemplatePdf(dto: PreviewCertificateTemplateDto): Promise<Buffer> {
    const templateConfig = dto.template || {};
    const sampleData = {
      studentName: dto.sampleData?.studentName || 'Alex Morgan',
      courseName:
        dto.sampleData?.courseName ||
        'Advanced Artificial Intelligence & Machine Learning',
      examName: dto.sampleData?.examName || 'AI & Deep Learning Master Exam',
      projectName:
        dto.sampleData?.projectName || 'Autonomous Neural Navigation System',
      completionDate:
        dto.sampleData?.completionDate ||
        new Date().toISOString().split('T')[0],
      certificateId: dto.sampleData?.certificateId || 'CERT-PREVIEW-2026-001',
      schoolName: dto.sampleData?.schoolName || 'Eduverse Academy',
      className: dto.sampleData?.className || 'Grade 12 - CS',
      grade: dto.sampleData?.grade || 'A+',
      marks: dto.sampleData?.marks || '96/100',
      teacherRemarks: 'Exemplary project architecture and flawless execution.',
      institutionName: dto.sampleData?.institutionName || 'Eduverse Academy',
    };

    return await this.certGenerator.renderDynamicTemplateToPdf(
      sampleData,
      templateConfig,
    );
  }
}
