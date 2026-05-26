import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { v4 as uuid } from 'uuid';
import { Client } from 'basic-ftp';
import { Readable } from 'stream';
import * as dotenv from 'dotenv';
dotenv.config();
import puppeteer from 'puppeteer';
import { examCompletionCertificateTemplate } from '../templates/certificate/exam-complitation-certificate.template';
import { courseCompletionCertificateTemplate } from '../templates/certificate/course-complitation-certificate.template';
import { projectCompletionCertificateTemplate } from '../templates/certificate/project-complitation-certificate.template';
const execFileAsync = promisify(execFile);
import { exec } from 'child_process';
import { participationCertificateTemplate } from '../templates/certificate/participation-certificate-template';
const execAsync = promisify(exec);
export interface CourseCertArgs {
  studentName: string;
  className: string;
  courseName: string;
  grade: string;
  schoolName?: string;
  teacherRemarks?: string;
  completionDate: string; // ISO date string
  certificateId: string;
}

export interface QuizCertArgs {
  studentName: string;
  className: string;
  examName: string;
  courseName: string;
  marks: string; // e.g. "85/100"
  completionDate: string; // ISO date string
  certificateId: string;
  teacherRemarks?: string;
  schoolName?: string;
  courseId?: number;
  grade?: string;
}

export interface CertificateUploadResult {
  filePath: string; // remote FTP path
  fileUrl: string; // public HTTP URL
}
export interface ProjectCertificateArgs {
  studentName: string;
  schoolName: string;
  projectName: string;
  courseName: string;
  grade: string;
  teacherRemarks: string;
  completedDate: string; // e.g. "17 May 2025"
  certificateId: string; // unique cert number
  className?: string;
}

@Injectable()
export class CertificateGeneratorService {
  private readonly logger = new Logger(CertificateGeneratorService.name);

  private get scriptPath() {
    const candidates = [
      process.env.CERTIFICATE_GENERATOR_SCRIPT,
      path.resolve(process.cwd(), 'scripts', 'generate-certificate.py'),
      path.resolve(__dirname, '../../../scripts/generate-certificate.py'),
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return candidates[0] ?? '';
  }

  private get pythonExecutablePath() {
    const candidates = [
      process.env.CERTIFICATE_GENERATOR_PYTHON,
      path.resolve(process.cwd(), '..', '.venv', 'bin', 'python'),
      path.resolve(process.cwd(), '..', '.venv', 'bin', 'python3'),
      '/opt/homebrew/bin/python3',
      'python3',
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      if (candidate.startsWith('/') && !fs.existsSync(candidate)) {
        continue;
      }

      return candidate;
    }

    return 'python3';
  }

  private readonly baseRemotePath = process.env.FTP_BASE_PATH ?? '/public_html';
  private readonly basePublicUrl =
    process.env.FTP_BASE_URL ?? 'https://files.edudigm.in';

  private get browserExecutablePath(): string | undefined {
    const candidates = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return undefined;
  }

  private get ftpConfig() {
    const password = process.env.FTP_PASSWORD ?? process.env.FTP_PASS ?? '';

    return {
      host: process.env.FTP_HOST ?? '',
      port: Number(process.env.FTP_PORT ?? 21),
      user: process.env.FTP_USER ?? '',
      password,
      secure: false,
    };
  }
  async generateCourseCertificate(
    args: CourseCertArgs,
  ): Promise<CertificateUploadResult> {
    return this.generateAndUpload('course', args);
  }
  async generateQuizCertificate(
    args: QuizCertArgs,
  ): Promise<CertificateUploadResult> {
    return this.generateAndUpload('quiz', args);
  }

  private getCertificateAssets() {
    const basePath = path.join(
      process.cwd(),
      'dist/src/services/templates/certificate',
    );

    const toBase64 = (file: string) => {
      const filePath = path.join(basePath, file);
      const ext = path.extname(file).replace('.', '');

      const base64 = fs.readFileSync(filePath, {
        encoding: 'base64',
      });

      return `data:image/${ext};base64,${base64}`;
    };

    return {
      globe: toBase64('globe.png'),
      logo: toBase64('eduverse_logo.png'),
      line: toBase64('Line.png'),
      sign: toBase64('RA_Sign.png'),
      signLine: toBase64('sign_line.png'),
      background: toBase64('background.jpg'),
      edudigm_logo: toBase64('Edudigm_Logo.png'),
      stem_powered_logo: toBase64('STEMpowered_logo.png'),
      header: toBase64('Header.png'),
      full_sign: toBase64('sign.png'),
    };
  }

  private async generateAndUpload(
    type: 'course' | 'quiz',
    args: CourseCertArgs | QuizCertArgs,
  ): Promise<CertificateUploadResult> {
    const tmpDir = os.tmpdir();
    const filename = `cert-${uuid()}.pdf`;
    const tmpFilePath = path.join(tmpDir, filename);

    try {
      // 1. Render HTML template -> PDF using Puppeteer
      let htmlContent = '';
      if (type === 'course') {
        const a = args as CourseCertArgs;
        const assets = this.getCertificateAssets();
        htmlContent = courseCompletionCertificateTemplate(
          a.courseName,
          a.studentName,
          a.completionDate,
          a.certificateId,
          assets,
          a.schoolName,
          a.className,
          a.grade,
        );
      } else {
        const a = args as QuizCertArgs;
        const assets = this.getCertificateAssets();
        if (
          a.courseId == 102 ||
          a.courseId == 103 ||
          a.courseId == 104 ||
          a.courseId == 108
        ) {
          htmlContent = participationCertificateTemplate(
            a.studentName,
            a.className,
            a.courseName,
            a.marks,
            a.grade ?? '',
            a.completionDate,
            assets,
            a.schoolName,
          );
        } else {
          htmlContent = examCompletionCertificateTemplate(
            a.studentName,
            a.examName,
            a.courseName,
            a.marks,
            a.completionDate,
            a.certificateId,
            assets,
            a.className,
            a.schoolName,
          );
        }
      }

      const pdfBuffer = await this.renderHtmlToPdfBuffer(htmlContent);
      fs.writeFileSync(tmpFilePath, pdfBuffer);

      // 2. Upload buffer to FTP
      const buffer = fs.readFileSync(tmpFilePath);
      const result = await this.uploadBufferViaFtp(
        buffer,
        filename,
        'certificates',
      );

      return result;
    } finally {
      // 3. Clean up temp file
      if (fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
      }
    }
  }
  async generateProjectCertificate(
    args: ProjectCertificateArgs,
  ): Promise<CertificateUploadResult> {
    const assets = this.getCertificateAssets();
    const html = projectCompletionCertificateTemplate(
      args.studentName,
      args.schoolName,
      args.projectName,
      args.courseName,
      args.grade,
      args.teacherRemarks,
      args.completedDate,
      args.certificateId,
      assets,
      args.className,
    );
    return this.htmlToPdfAndUpload(html, 'certificates');
  }
  private async htmlToPdfAndUpload(
    html: string,
    type: string,
  ): Promise<CertificateUploadResult> {
    const tmpDir = os.tmpdir();
    const baseName = uuid();
    const htmlPath = path.join(tmpDir, `${baseName}.html`);
    const pdfPath = path.join(tmpDir, `${baseName}.pdf`);

    try {
      // 1. Write HTML temp file
      fs.writeFileSync(htmlPath, html, 'utf8');

      // 2. Convert to PDF via wkhtmltopdf
      await this.runWkhtmltopdf(htmlPath, pdfPath);

      // 3. Read buffer and upload
      const buffer = fs.readFileSync(pdfPath);
      return this.uploadBufferViaFtp(buffer, `${baseName}.pdf`, type);
    } finally {
      // Clean up temp files
      for (const f of [htmlPath, pdfPath]) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }
    }
  }
  private async runWkhtmltopdf(
    htmlPath: string,
    pdfPath: string,
  ): Promise<void> {
    // Page sized to match the 1200×850 certificate canvas (px → points at 96dpi)
    const cmd = [
      'wkhtmltopdf',
      '--page-width 1260px',
      '--page-height 910px',
      '--zoom 1',
      '--margin-top 0',
      '--margin-bottom 0',
      '--margin-left 0',
      '--margin-right 0',
      '--enable-local-file-access',
      '--quiet',
      `"${htmlPath}"`,
      `"${pdfPath}"`,
    ].join(' ');

    try {
      await execAsync(cmd);
    } catch (err: any) {
      this.logger.error('wkhtmltopdf failed', err?.stderr ?? err?.message);
      throw new InternalServerErrorException(
        'Certificate PDF generation failed',
      );
    }
  }

  private async runPythonGenerator(
    type: 'course' | 'quiz',
    args: object,
    outputPath: string,
  ): Promise<void> {
    const jsonArgs = JSON.stringify(args);

    if (!this.scriptPath) {
      throw new InternalServerErrorException(
        'Certificate generator script path is not configured',
      );
    }

    try {
      const { stdout, stderr } = await execFileAsync(
        this.pythonExecutablePath,
        [this.scriptPath, type, jsonArgs, outputPath],
      );

      if (stderr) {
        this.logger.warn(`Certificate generator stderr: ${stderr}`);
      }

      this.logger.debug(`Certificate generated at: ${stdout.trim()}`);
    } catch (err: any) {
      this.logger.error(
        'Certificate generation failed',
        err?.stderr ?? err?.message,
      );
      throw new InternalServerErrorException(
        'Failed to generate certificate PDF',
      );
    }
  }

  private async renderHtmlToPdfBuffer(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: this.browserExecutablePath,
      headless: 'new',
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        printBackground: true,
        width: '1200px',
        height: '850px',
        margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
      });
      return pdf;
    } finally {
      await browser.close();
    }
  }

  private async uploadBufferViaFtp(
    buffer: Buffer,
    originalName: string,
    type: string,
  ): Promise<CertificateUploadResult> {
    const client = new Client();
    const extension = path.extname(originalName);
    const filename = `${uuid()}${extension}`;
    const remoteDir = `${this.baseRemotePath}/content/${type}`;
    const remotePath = `${remoteDir}/${filename}`;

    try {
      await client.access(this.ftpConfig);
      await client.ensureDir(remoteDir);
      await client.cd(remoteDir);

      const stream = Readable.from(buffer);
      await client.uploadFrom(stream, filename);

      return {
        filePath: `/content/${type}/${filename}`,
        fileUrl: `${this.basePublicUrl}/content/${type}/${filename}`,
      };
    } catch (error: any) {
      this.logger.error('FTP upload error', error?.message);
      throw new InternalServerErrorException(
        error?.message ?? 'Certificate upload failed',
      );
    } finally {
      client.close();
    }
  }
}
