import { Injectable, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

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
    const ext = path.extname(originalName);
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

  validateImage(file: Express.Multer.File): void {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(
        'Only image files are allowed (jpeg, png, webp, gif)',
      );
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds 5MB limit');
    }
  }
}
