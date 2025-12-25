
import * as fs from 'fs';
import * as path from 'path';

export class Base64FileUtil {
  
  static async saveBase64File(base64Data: string, uploadDir = 'uploads'): Promise<{
    filePath: string;
    fileName: string;
    mimeType: string;
  }> {
    // Extract meta info: data:image/png;base64,XXXX
    const matches = base64Data.match(/^data:(.+);base64,(.+)$/);

    if (!matches) {
      throw new Error('Invalid base64 format.');
    }

    const mimeType = matches[1];
    const ext = mimeType.split('/')[1]; // e.g. png, jpg, pdf
    const buffer = Buffer.from(matches[2], 'base64');

    // ensure uploads directory exists
    const fullUploadPath = path.join(process.cwd(), uploadDir);

    if (!fs.existsSync(fullUploadPath)) {
      fs.mkdirSync(fullUploadPath, { recursive: true });
    }

    // generate file name
    const fileName = `${Date.now()}.${ext}`;
    const filePath = path.join(fullUploadPath, fileName);

    // write file
    fs.writeFileSync(filePath, new Uint8Array(buffer));

    return {
      filePath,
      fileName,
      mimeType,
    };
  }
}
