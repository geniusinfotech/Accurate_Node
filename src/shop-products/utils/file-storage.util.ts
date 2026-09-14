import * as fs from 'fs';
import * as path from 'path';

export class FileStorageUtil {
  /**
   * Get the Excel storage path based on shopBrand and shopCategory
   * Format: /uploads/excel/{shopBrandCode}/{shopCategorySlug}/{YYYY-MM-DD}/
   */
  static getExcelStoragePath(
    shopBrandCode: string,
    shopCategorySlug: string,
  ): string {
    const date = new Date();
    const dateFolder = date.toISOString().split('T')[0]; // YYYY-MM-DD

    const storagePath = path.join(
      process.cwd(),
      'uploads',
      'excel',
      shopBrandCode.toLowerCase(),
      shopCategorySlug.toLowerCase(),
      dateFolder,
    );

    // Create directories if they don't exist
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }

    return storagePath;
  }

  /**
   * Get the image storage path
   * Format: /uploads/images/shopProducts/
   */
  static getImageStoragePath(): string {
    const storagePath = path.join(
      process.cwd(),
      'uploads',
      'images',
      'shop-products',
    );

    // Create directory if it doesn't exist
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }

    return storagePath;
  }

  /**
   * Safely delete a file with error handling
   */
  static deleteFile(filePath: string): { success: boolean; error?: string } {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return { success: true };
      } else {
        return { success: false, error: 'File does not exist' };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate unique filename with timestamp
   */
  static generateUniqueFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    return `${timestamp}-${random}${ext}`;
  }
}
