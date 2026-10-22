import { Injectable, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

/** First-bytes signature of each accepted image type. */
const IMAGE_SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  'image/gif': (b) => b.toString('ascii', 0, 4) === 'GIF8',
  'image/webp': (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
};

@Injectable()
export class UploadService {
  private readonly uploadDir = './uploads';

  getUploadPath(subdir: string = ''): string {
    const dir = subdir ? path.join(this.uploadDir, subdir) : this.uploadDir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  generateFilename(originalName: string, prefix: string = 'file'): string {
    // Never keep a client-chosen extension like .html or .svg: it decides how the file is served.
    const ext = path.extname(originalName).toLowerCase();
    if (!IMAGE_EXTENSIONS.includes(ext)) {
      throw new BadRequestException('Only .jpg, .png, .webp or .gif images are allowed');
    }
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    return `${prefix}-${timestamp}-${random}${ext}`;
  }

  moveFile(sourcePath: string, targetSubdir: string, filename: string): string {
    const targetDir = this.getUploadPath(targetSubdir);
    const destPath = path.join(targetDir, filename);
    fs.renameSync(sourcePath, destPath);
    return path.join(targetSubdir, filename).replace(/\\/g, '/');
  }

  deleteFile(relativePath: string): boolean {
    const safe = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
    if (safe.includes('..') || path.isAbsolute(safe))
      throw new BadRequestException('Invalid file path');
    const fullPath = path.join(this.uploadDir, safe);
    const resolved = path.resolve(fullPath);
    const base = path.resolve(this.uploadDir);
    if (!resolved.startsWith(base))
      throw new BadRequestException('Invalid file path');
    if (fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
      return true;
    }
    return false;
  }

  /**
   * Checks size, declared type AND the file's real first bytes (the declared type and name
   * come from the client and prove nothing). A rejected upload is deleted from the temp
   * folder straight away.
   */
  validateImage(file: Express.Multer.File): void {
    try {
      const allowed = Object.keys(IMAGE_SIGNATURES);
      if (!allowed.includes(file.mimetype)) {
        throw new BadRequestException('Only image files are allowed (jpeg, png, webp, gif)');
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new BadRequestException('File size exceeds 5MB limit');
      }
      const head = Buffer.alloc(12);
      if (file.path) {
        const fd = fs.openSync(file.path, 'r');
        try {
          fs.readSync(fd, head, 0, 12, 0);
        } finally {
          fs.closeSync(fd);
        }
      } else if (file.buffer) {
        file.buffer.copy(head, 0, 0, 12);
      }
      if (!IMAGE_SIGNATURES[file.mimetype](head)) {
        throw new BadRequestException('The file content is not a valid image');
      }
    } catch (err) {
      if (file.path) fs.unlink(file.path, () => undefined);
      throw err;
    }
  }
}
