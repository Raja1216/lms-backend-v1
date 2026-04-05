
import * as fs from 'fs';
import * as path from 'path';

export class Base64FileUtil {
  static parseBase64(base64Data: string): {
    buffer: Buffer;
    mimeType: string;
    extension: string;
  } {
    const matches = base64Data.match(/^data:(.+);base64,(.+)$/);

    if (!matches) {
      throw new Error('Invalid base64 format.');
    }

    const mimeType = matches[1];
    const extension = mimeType.split('/')[1];
    const buffer = Buffer.from(matches[2], 'base64');

    return { buffer, mimeType, extension };
  }
}
