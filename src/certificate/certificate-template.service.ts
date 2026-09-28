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
  AssignQuizTemplateDto,
  AssignProjectTemplateDto,
} from './dto/certificate-template.dto';

const TEMPLATE_INCLUDE = {
  course: { select: { id: true, title: true, slug: true } },
  quiz: { select: { id: true, title: true, slug: true } },
  project: { select: { id: true, title: true, slug: true } },
  institution: { select: { id: true, name: true, slug: true } },
};

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

    if (query?.quizId) {
      where.quizId = Number(query.quizId);
    }

    if (query?.projectId) {
      where.projectId = Number(query.projectId);
    }

    const [data, total] = await Promise.all([
      this.prisma.certificateTemplate.findMany({
        where,
        include: TEMPLATE_INCLUDE,
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
      include: TEMPLATE_INCLUDE,
    });
    if (!template) {
      throw new NotFoundException(`Certificate template #${id} not found`);
    }
    return template;
  }

  async createTemplate(dto: CreateCertificateTemplateDto) {
    const type = dto.type || 'course';

    // If set to default, unset other defaults of the same type
    if (dto.isDefault) {
      await this.prisma.certificateTemplate.updateMany({
        where: { type, isDefault: true },
        data: { isDefault: false },
      });
    }

    return await this.prisma.certificateTemplate.create({
      data: {
        title: dto.title,
        description: dto.description,
        type,
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
        courseId: dto.courseId || null,
        quizId: dto.quizId || null,
        projectId: dto.projectId || null,
        institutionId: dto.institutionId || null,
        isDefault: dto.isDefault ?? false,
        status: dto.status ?? true,
      },
      include: TEMPLATE_INCLUDE,
    });
  }

  async updateTemplate(id: number, dto: UpdateCertificateTemplateDto) {
    const existing = await this.prisma.certificateTemplate.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Certificate template #${id} not found`);
    }

    const type = dto.type !== undefined ? dto.type : existing.type;

    if (dto.isDefault) {
      await this.prisma.certificateTemplate.updateMany({
        where: { type, isDefault: true, id: { not: id } },
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
        ...(dto.quizId !== undefined && { quizId: dto.quizId }),
        ...(dto.projectId !== undefined && { projectId: dto.projectId }),
        ...(dto.institutionId !== undefined && { institutionId: dto.institutionId }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: TEMPLATE_INCLUDE,
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
        where: { type: existing.type, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.certificateTemplate.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    return { success: true, message: `Default ${existing.type} certificate template updated` };
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

  async assignQuizTemplate(dto: AssignQuizTemplateDto) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: dto.quizId },
    });
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
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
        data: { quizId: dto.quizId },
      });
    } else {
      await this.prisma.certificateTemplate.updateMany({
        where: { quizId: dto.quizId },
        data: { quizId: null },
      });
    }

    return { success: true, message: 'Quiz certificate template assignment updated' };
  }

  async assignProjectTemplate(dto: AssignProjectTemplateDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
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
        data: { projectId: dto.projectId },
      });
    } else {
      await this.prisma.certificateTemplate.updateMany({
        where: { projectId: dto.projectId },
        data: { projectId: null },
      });
    }

    return { success: true, message: 'Project certificate template assignment updated' };
  }

  /**
   * Resolve template with hierarchy:
   * 1. Specific courseId / quizId / projectId
   * 2. Default for specific type ('course' | 'quiz' | 'project')
   * 3. Any active template for specific type
   * 4. Default for 'all'
   * 5. Any active template for 'all'
   * 6. Global default or active template
   */
  async resolveTemplate(
    targetType: 'course' | 'quiz' | 'project',
    targetId?: number,
  ) {
    // 1. Specific Target Template
    if (targetId) {
      if (targetType === 'course') {
        const specific = await this.prisma.certificateTemplate.findFirst({
          where: { courseId: targetId, status: true },
          include: TEMPLATE_INCLUDE,
        });
        if (specific) return specific;
      } else if (targetType === 'quiz') {
        const specific = await this.prisma.certificateTemplate.findFirst({
          where: { quizId: targetId, status: true },
          include: TEMPLATE_INCLUDE,
        });
        if (specific) return specific;
      } else if (targetType === 'project') {
        const specific = await this.prisma.certificateTemplate.findFirst({
          where: { projectId: targetId, status: true },
          include: TEMPLATE_INCLUDE,
        });
        if (specific) return specific;
      }
    }

    // 2. Default template for targetType
    const typeDefault = await this.prisma.certificateTemplate.findFirst({
      where: {
        type: targetType,
        isDefault: true,
        status: true,
        courseId: null,
        quizId: null,
        projectId: null,
      },
      include: TEMPLATE_INCLUDE,
    });
    if (typeDefault) return typeDefault;

    // 3. Any active template for targetType (not assigned to specific other entity)
    const anyType = await this.prisma.certificateTemplate.findFirst({
      where: {
        type: targetType,
        status: true,
        courseId: null,
        quizId: null,
        projectId: null,
      },
      include: TEMPLATE_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    if (anyType) return anyType;

    // 4. Default template for 'all'
    const allDefault = await this.prisma.certificateTemplate.findFirst({
      where: { type: 'all', isDefault: true, status: true },
      include: TEMPLATE_INCLUDE,
    });
    if (allDefault) return allDefault;

    // 5. Any active template for 'all'
    const anyAll = await this.prisma.certificateTemplate.findFirst({
      where: { type: 'all', status: true },
      include: TEMPLATE_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    if (anyAll) return anyAll;

    // 6. Global fallback to any active default template
    const globalDefault = await this.prisma.certificateTemplate.findFirst({
      where: { isDefault: true, status: true },
      include: TEMPLATE_INCLUDE,
    });
    if (globalDefault) return globalDefault;

    // 7. Last resort: any active template
    return await this.prisma.certificateTemplate.findFirst({
      where: { status: true },
      include: TEMPLATE_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Certificate Settings (Static vs Dynamic mode)
   */
  async getCertificateMode(): Promise<'static' | 'dynamic'> {
    try {
      const setting = await this.prisma.systemSetting.findUnique({
        where: { key: 'certificate_generation_mode' },
      });
      if (setting && setting.value === 'static') {
        return 'static';
      }
      return 'dynamic';
    } catch {
      return 'dynamic';
    }
  }

  async getCertificateSettings() {
    const mode = await this.getCertificateMode();

    const [
      defaultCourseTemplate,
      defaultQuizTemplate,
      defaultProjectTemplate,
      defaultAllTemplate,
    ] = await Promise.all([
      this.prisma.certificateTemplate.findFirst({
        where: { type: 'course', isDefault: true },
        select: { id: true, title: true, type: true },
      }),
      this.prisma.certificateTemplate.findFirst({
        where: { type: 'quiz', isDefault: true },
        select: { id: true, title: true, type: true },
      }),
      this.prisma.certificateTemplate.findFirst({
        where: { type: 'project', isDefault: true },
        select: { id: true, title: true, type: true },
      }),
      this.prisma.certificateTemplate.findFirst({
        where: { type: 'all', isDefault: true },
        select: { id: true, title: true, type: true },
      }),
    ]);

    return {
      mode,
      defaults: {
        course: defaultCourseTemplate,
        quiz: defaultQuizTemplate,
        project: defaultProjectTemplate,
        all: defaultAllTemplate,
      },
    };
  }

  async updateCertificateSettings(mode: 'static' | 'dynamic') {
    if (mode !== 'static' && mode !== 'dynamic') {
      throw new BadRequestException('Mode must be either "static" or "dynamic"');
    }

    await this.prisma.systemSetting.upsert({
      where: { key: 'certificate_generation_mode' },
      update: { value: mode },
      create: {
        key: 'certificate_generation_mode',
        value: mode,
        description: 'Certificate generation engine mode (static or dynamic)',
      },
    });

    return await this.getCertificateSettings();
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
