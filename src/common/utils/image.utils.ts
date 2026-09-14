import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class ImageUtils {
  /**
   * Compresses and resizes an image
   * @param file - The uploaded file object
   * @param maxWidth - Maximum width for the resized image (default: 1200)
   * @param quality - Quality of the output image (1-100, default: 80)
   * @returns Promise with the compressed file path
   */
  async compressImage(
    file: Express.Multer.File,
    maxWidth = 1200,
    quality = 80,
  ): Promise<string> {
    // Create a unique filename for the compressed image
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `compressed-${uniqueSuffix}${ext}`;
    const uploadPath = path.join(process.cwd(), 'uploads');
    const outputPath = path.join(uploadPath, filename);

    // Ensure uploads directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    // Process the image with sharp
    const image = sharp(file.buffer);
    const metadata = await image.metadata();

    // Only resize if image is wider than maxWidth
    const shouldResize = metadata.width && metadata.width > maxWidth;

    const pipeline = shouldResize
      ? image.resize({
          width: maxWidth,
          fit: 'inside',
          withoutEnlargement: true,
        })
      : image;

    await pipeline
      .jpeg({ quality, progressive: true, force: false })
      .png({ quality, force: false })
      .webp({ quality, force: false })
      .toFile(outputPath);

    return filename;
  }

  /**
   * Deletes a file from the filesystem
   * @param filename - Name of the file to delete
   */
  deleteFile(filename: string): void {
    const filePath = path.join(process.cwd(), 'uploads', filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
