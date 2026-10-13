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

    // Extract target IDs strictly according to type
    let targetIds: number[] = [];
    if (type === 'course') {
      targetIds = Array.isArray(dto.courseIds) && dto.courseIds.length > 0
        ? dto.courseIds.map(Number).filter(Boolean)
        : (dto.courseId ? [Number(dto.courseId)] : []);
    } else if (type === 'quiz') {
      targetIds = Array.isArray(dto.quizIds) && dto.quizIds.length > 0
        ? dto.quizIds.map(Number).filter(Boolean)
        : (dto.quizId ? [Number(dto.quizId)] : []);
    } else if (type === 'project') {
      targetIds = Array.isArray(dto.projectIds) && dto.projectIds.length > 0
        ? dto.projectIds.map(Number).filter(Boolean)
        : (dto.projectId ? [Number(dto.projectId)] : []);
    }

    // If set to default, unset other defaults of the same type
    if (dto.isDefault) {
      await this.prisma.certificateTemplate.updateMany({
        where: { type, isDefault: true },
        data: { isDefault: false },
      });
    }

    const baseData = {
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
      institutionId: dto.institutionId || null,
      isDefault: dto.isDefault ?? false,
      status: dto.status ?? true,
    };

    // If multiple targets selected, create multiple rows
    if (targetIds.length > 0) {
      const createdTemplates: any[] = [];
      for (const targetId of targetIds) {
        // Enforce type & ID in code level: strictly set corresponding ID and nullify the others
        const created = await this.prisma.certificateTemplate.create({
          data: {
            ...baseData,
            courseId: type === 'course' ? targetId : null,
            quizId: type === 'quiz' ? targetId : null,
            projectId: type === 'project' ? targetId : null,
          },
          include: TEMPLATE_INCLUDE,
        });
        createdTemplates.push(created);
      }
      return createdTemplates[0];
    }

    // Default / Unassigned template: single row with null IDs
    return await this.prisma.certificateTemplate.create({
      data: {
        ...baseData,
        courseId: null,
        quizId: null,
        projectId: null,
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

    // Extract target IDs strictly according to type
    let targetIds: number[] | null = null;
    if (type === 'course') {
      if (dto.courseIds !== undefined) {
        targetIds = Array.isArray(dto.courseIds) ? dto.courseIds.map(Number).filter(Boolean) : [];
      } else if (dto.courseId !== undefined) {
        targetIds = dto.courseId ? [Number(dto.courseId)] : [];
      }
    } else if (type === 'quiz') {
      if (dto.quizIds !== undefined) {
        targetIds = Array.isArray(dto.quizIds) ? dto.quizIds.map(Number).filter(Boolean) : [];
      } else if (dto.quizId !== undefined) {
        targetIds = dto.quizId ? [Number(dto.quizId)] : [];
      }
    } else if (type === 'project') {
      if (dto.projectIds !== undefined) {
        targetIds = Array.isArray(dto.projectIds) ? dto.projectIds.map(Number).filter(Boolean) : [];
      } else if (dto.projectId !== undefined) {
        targetIds = dto.projectId ? [Number(dto.projectId)] : [];
      }
    } else if (type === 'all') {
      targetIds = [];
    }

    // Enforce type & ID strictly at code level
    let primaryCourseId: number | null = null;
    let primaryQuizId: number | null = null;
    let primaryProjectId: number | null = null;

    if (type === 'course') {
      primaryCourseId = targetIds !== null ? (targetIds[0] || null) : existing.courseId;
      primaryQuizId = null;
      primaryProjectId = null;
    } else if (type === 'quiz') {
      primaryQuizId = targetIds !== null ? (targetIds[0] || null) : existing.quizId;
      primaryCourseId = null;
      primaryProjectId = null;
    } else if (type === 'project') {
      primaryProjectId = targetIds !== null ? (targetIds[0] || null) : existing.projectId;
      primaryCourseId = null;
      primaryQuizId = null;
    } else if (type === 'all') {
      primaryCourseId = null;
      primaryQuizId = null;
      primaryProjectId = null;
    }

    const updated = await this.prisma.certificateTemplate.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        type,
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
        ...(dto.institutionId !== undefined && { institutionId: dto.institutionId }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        ...(dto.status !== undefined && { status: dto.status }),
        // Strictly sanitized type & IDs at code level
        courseId: primaryCourseId,
        quizId: primaryQuizId,
        projectId: primaryProjectId,
      },
      include: TEMPLATE_INCLUDE,
    });

    // If multiple target IDs are specified, create multiple rows for the additional targets
    if (targetIds && targetIds.length > 1) {
      const additionalTargetIds = targetIds.slice(1);
      for (const addId of additionalTargetIds) {
        await this.prisma.certificateTemplate.create({
          data: {
            title: updated.title,
            description: updated.description,
            type: updated.type,
            backgroundUrl: updated.backgroundUrl,
            logoUrl: updated.logoUrl,
            secondaryLogoUrl: updated.secondaryLogoUrl,
            signatureUrl: updated.signatureUrl,
            signatoryName: updated.signatoryName,
            signatoryTitle: updated.signatoryTitle,
            primaryColor: updated.primaryColor,
            secondaryColor: updated.secondaryColor,
            textColor: updated.textColor,
            fontFamily: updated.fontFamily,
            headerText: updated.headerText,
            subHeaderText: updated.subHeaderText,
            bodyText: updated.bodyText,
            footerText: updated.footerText,
            showQrCode: updated.showQrCode,
            showGrade: updated.showGrade,
            showScore: updated.showScore,
            showIssueDate: updated.showIssueDate,
            showCertificateId: updated.showCertificateId,
            customHtml: updated.customHtml,
            institutionId: updated.institutionId,
            isDefault: false,
            status: updated.status,
            courseId: type === 'course' ? addId : null,
            quizId: type === 'quiz' ? addId : null,
            projectId: type === 'project' ? addId : null,
          },
        });
      }
    }

    return updated;
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
    const courseIds = Array.isArray(dto.courseIds) && dto.courseIds.length > 0
      ? dto.courseIds.map(Number).filter(Boolean)
      : (dto.courseId ? [Number(dto.courseId)] : []);

    if (courseIds.length === 0) {
      throw new BadRequestException('At least one course ID must be provided');
    }

    if (!dto.templateId) {
      await this.prisma.certificateTemplate.updateMany({
        where: { courseId: { in: courseIds } },
        data: { courseId: null },
      });
      return { success: true, message: 'Course certificate template assignment cleared' };
    }

    const template = await this.prisma.certificateTemplate.findUnique({
      where: { id: dto.templateId },
    });
    if (!template) {
      throw new NotFoundException('Certificate template not found');
    }

    // Assign the template row to the first course
    await this.prisma.certificateTemplate.update({
      where: { id: dto.templateId },
      data: {
        type: 'course',
        courseId: courseIds[0],
        quizId: null,
        projectId: null,
      },
    });

    // For every additional course, create a multiple row with strict type & ID
    for (let i = 1; i < courseIds.length; i++) {
      const cid = courseIds[i];
      await this.prisma.certificateTemplate.create({
        data: {
          title: template.title,
          description: template.description,
          type: 'course',
          backgroundUrl: template.backgroundUrl,
          logoUrl: template.logoUrl,
          secondaryLogoUrl: template.secondaryLogoUrl,
          signatureUrl: template.signatureUrl,
          signatoryName: template.signatoryName,
          signatoryTitle: template.signatoryTitle,
          primaryColor: template.primaryColor,
          secondaryColor: template.secondaryColor,
          textColor: template.textColor,
          fontFamily: template.fontFamily,
          headerText: template.headerText,
          subHeaderText: template.subHeaderText,
          bodyText: template.bodyText,
          footerText: template.footerText,
          showQrCode: template.showQrCode,
          showGrade: template.showGrade,
          showScore: template.showScore,
          showIssueDate: template.showIssueDate,
          showCertificateId: template.showCertificateId,
          customHtml: template.customHtml,
          institutionId: template.institutionId,
          isDefault: false,
          status: template.status,
          courseId: cid,
          quizId: null,
          projectId: null,
        },
      });
    }

    return { success: true, message: 'Course certificate template assignment updated' };
  }

  async assignQuizTemplate(dto: AssignQuizTemplateDto) {
    const quizIds = Array.isArray(dto.quizIds) && dto.quizIds.length > 0
      ? dto.quizIds.map(Number).filter(Boolean)
      : (dto.quizId ? [Number(dto.quizId)] : []);

    if (quizIds.length === 0) {
      throw new BadRequestException('At least one quiz ID must be provided');
    }

    if (!dto.templateId) {
      await this.prisma.certificateTemplate.updateMany({
        where: { quizId: { in: quizIds } },
        data: { quizId: null },
      });
      return { success: true, message: 'Quiz certificate template assignment cleared' };
    }

    const template = await this.prisma.certificateTemplate.findUnique({
      where: { id: dto.templateId },
    });
    if (!template) {
      throw new NotFoundException('Certificate template not found');
    }

    // Assign the template row to the first quiz
    await this.prisma.certificateTemplate.update({
      where: { id: dto.templateId },
      data: {
        type: 'quiz',
        quizId: quizIds[0],
        courseId: null,
        projectId: null,
      },
    });

    // For every additional quiz, create a multiple row with strict type & ID
    for (let i = 1; i < quizIds.length; i++) {
      const qid = quizIds[i];
      await this.prisma.certificateTemplate.create({
        data: {
          title: template.title,
          description: template.description,
          type: 'quiz',
          backgroundUrl: template.backgroundUrl,
          logoUrl: template.logoUrl,
          secondaryLogoUrl: template.secondaryLogoUrl,
          signatureUrl: template.signatureUrl,
          signatoryName: template.signatoryName,
          signatoryTitle: template.signatoryTitle,
          primaryColor: template.primaryColor,
          secondaryColor: template.secondaryColor,
          textColor: template.textColor,
          fontFamily: template.fontFamily,
          headerText: template.headerText,
          subHeaderText: template.subHeaderText,
          bodyText: template.bodyText,
          footerText: template.footerText,
          showQrCode: template.showQrCode,
          showGrade: template.showGrade,
          showScore: template.showScore,
          showIssueDate: template.showIssueDate,
          showCertificateId: template.showCertificateId,
          customHtml: template.customHtml,
          institutionId: template.institutionId,
          isDefault: false,
          status: template.status,
          courseId: null,
          quizId: qid,
          projectId: null,
        },
      });
    }

    return { success: true, message: 'Quiz certificate template assignment updated' };
  }

  async assignProjectTemplate(dto: AssignProjectTemplateDto) {
    const projectIds = Array.isArray(dto.projectIds) && dto.projectIds.length > 0
      ? dto.projectIds.map(Number).filter(Boolean)
      : (dto.projectId ? [Number(dto.projectId)] : []);

    if (projectIds.length === 0) {
      throw new BadRequestException('At least one project ID must be provided');
    }

    if (!dto.templateId) {
      await this.prisma.certificateTemplate.updateMany({
        where: { projectId: { in: projectIds } },
        data: { projectId: null },
      });
      return { success: true, message: 'Project certificate template assignment cleared' };
    }

    const template = await this.prisma.certificateTemplate.findUnique({
      where: { id: dto.templateId },
    });
    if (!template) {
      throw new NotFoundException('Certificate template not found');
    }

    // Assign the template row to the first project
    await this.prisma.certificateTemplate.update({
      where: { id: dto.templateId },
      data: {
        type: 'project',
        projectId: projectIds[0],
        courseId: null,
        quizId: null,
      },
    });

    // For every additional project, create a multiple row with strict type & ID
    for (let i = 1; i < projectIds.length; i++) {
      const pid = projectIds[i];
      await this.prisma.certificateTemplate.create({
        data: {
          title: template.title,
          description: template.description,
          type: 'project',
          backgroundUrl: template.backgroundUrl,
          logoUrl: template.logoUrl,
          secondaryLogoUrl: template.secondaryLogoUrl,
          signatureUrl: template.signatureUrl,
          signatoryName: template.signatoryName,
          signatoryTitle: template.signatoryTitle,
          primaryColor: template.primaryColor,
          secondaryColor: template.secondaryColor,
          textColor: template.textColor,
          fontFamily: template.fontFamily,
          headerText: template.headerText,
          subHeaderText: template.subHeaderText,
          bodyText: template.bodyText,
          footerText: template.footerText,
          showQrCode: template.showQrCode,
          showGrade: template.showGrade,
          showScore: template.showScore,
          showIssueDate: template.showIssueDate,
          showCertificateId: template.showCertificateId,
          customHtml: template.customHtml,
          institutionId: template.institutionId,
          isDefault: false,
          status: template.status,
          courseId: null,
          quizId: null,
          projectId: pid,
        },
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
      studentName: dto.sampleData?.studentName || 'Alex R. Morgan',
      courseName:
        dto.sampleData?.courseName ||
        'Advanced AI & Fullstack Engineering',
      examName: dto.sampleData?.examName || 'Comprehensive Final Assessment',
      projectName:
        dto.sampleData?.projectName || 'Autonomous Multi-Agent AI System',
      completionDate:
        dto.sampleData?.completionDate ||
        dto.sampleData?.date ||
        new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      certificateId:
        dto.sampleData?.certificateId ||
        dto.sampleData?.certificateNumber ||
        'LV-2026-DEMO-994',
      schoolName: dto.sampleData?.schoolName || '',
      className: dto.sampleData?.className || 'Cohort 2026',
      grade: dto.sampleData?.grade || 'A+ Distinction',
      marks: dto.sampleData?.marks || '96%',
      teacherRemarks: '',
      institutionName: dto.sampleData?.institutionName || '',
    };

    return await this.certGenerator.renderDynamicTemplateToPdf(
      sampleData,
      templateConfig,
    );
  }
}
