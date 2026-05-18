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

const execFileAsync = promisify(execFile);

export interface CourseCertArgs {
  studentName: string;
  className: string;
  courseName: string;
  grade: string;
  teacherRemarks?: string;
  completionDate: string; // ISO date string
}

export interface QuizCertArgs {
  studentName: string;
  className: string;
  examName: string;
  courseName: string;
  marks: string; // e.g. "85/100"
  teacherRemarks?: string;
}

export interface CertificateUploadResult {
  filePath: string; // remote FTP path
  fileUrl: string; // public HTTP URL
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

  private async generateAndUpload(
    type: 'course' | 'quiz',
    args: CourseCertArgs | QuizCertArgs,
  ): Promise<CertificateUploadResult> {
    const tmpDir = os.tmpdir();
    const filename = `cert-${uuid()}.pdf`;
    const tmpFilePath = path.join(tmpDir, filename);

    try {
      // 1. Generate PDF via Python script
      await this.runPythonGenerator(type, args, tmpFilePath);

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
