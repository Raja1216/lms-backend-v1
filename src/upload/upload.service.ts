import { Injectable, BadRequestException } from '@nestjs/common';
import { Client } from 'basic-ftp';
import { v4 as uuid } from 'uuid';
import { extname } from 'path';
import { Readable } from 'stream';

@Injectable()
export class UploadService {
  private readonly ftpConfig = {
    host: 'ftp.edudigm.in',
    user: 'u389084088.eduvarsefile143',
    password: '5^R5G^bdLjppOoLl',
    port: 21,
    secure: false,
  };

  private readonly baseRemotePath = '/files';
  private readonly basePublicUrl = 'https://files.edudigm.in';

  async uploadFile(file: Express.Multer.File, type: string) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const allowedTypes = ['video', 'pdf', 'image', 'pptx', 'latex'];
    if (!allowedTypes.includes(type)) {
      throw new BadRequestException('Invalid file type');
    }

    // 🟡 LOCAL DEV → MOCK UPLOAD
    if (process.env.UPLOAD_MODE === 'local') {
      const ext = extname(file.originalname);
      const filename = `dev-${uuid()}${ext}`;

      return {
        url: `${this.basePublicUrl}/content/${type}/${filename}`,
        filename: file.originalname,
        size: file.size,
        mock: true,
      };
    }

    // 🟢 PRODUCTION → REAL FTP UPLOAD
    return this.uploadViaFtp(file, type);
  }

  private async uploadViaFtp(file: Express.Multer.File, type: string) {
    const client = new Client();
    const extension = extname(file.originalname);
    const filename = `${uuid()}${extension}`;
    const remoteDir = `${this.baseRemotePath}/content/${type}`;

    try {
      await client.access(this.ftpConfig);

      await client.ensureDir(remoteDir);
      await client.cd(remoteDir);

      const stream = Readable.from(file.buffer);
      await client.uploadFrom(stream, filename);

      return {
        url: `${this.basePublicUrl}/content/${type}/${filename}`,
        filename: file.originalname,
        size: file.size,
      };
    } catch (error) {
      console.error('FTP upload error:', error);
      throw new BadRequestException(error?.message || 'File upload failed');
    } finally {
      client.close();
    }
  }
}
