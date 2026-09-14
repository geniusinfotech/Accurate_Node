import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import {
  ExcelUploadHistory,
  ExcelUploadHistoryDocument,
} from '../schemas/excel-upload-history.schema';

@Injectable()
export class ExcelCleanupService {
  private readonly logger = new Logger(ExcelCleanupService.name);

  constructor(
    @InjectModel(ExcelUploadHistory.name)
    private excelHistoryModel: Model<ExcelUploadHistoryDocument>,
  ) {}

  /**
   * Find and delete Excel files older than 30 days
   */
  async cleanupOldUploads(): Promise<{
    deletedFiles: number;
    errors: Array<{ uploadId: any; filePath: string; error: string }>;
  }> {
    const errors: Array<{ uploadId: any; filePath: string; error: string }> =
      [];
    let deletedFiles = 0;

    try {
      // Calculate cutoff date (30 days ago)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);

      this.logger.log(
        `Starting cleanup for uploads older than ${cutoffDate.toISOString()}`,
      );

      // Find all uploads older than 30 days
      const oldUploads = await this.excelHistoryModel
        .find({ createdAt: { $lt: cutoffDate } })
        .exec();

      this.logger.log(`Found ${oldUploads.length} old uploads to clean up`);

      // Delete each file and its history record
      for (const upload of oldUploads) {
        try {
          // Delete file from filesystem
          if (fs.existsSync(upload.filePath)) {
            fs.unlinkSync(upload.filePath);
            this.logger.log(`Deleted file: ${upload.filePath}`);
          } else {
            this.logger.warn(`File not found: ${upload.filePath}`);
          }

          // Delete history record
          await this.excelHistoryModel.findByIdAndDelete(upload._id);
          deletedFiles++;
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`Error deleting upload ${upload._id}: ${errorMsg}`);
          errors.push({
            uploadId: upload._id,
            filePath: upload.filePath,
            error: errorMsg,
          });
        }
      }

      this.logger.log(
        `Cleanup completed: ${deletedFiles} files deleted, ${errors.length} errors`,
      );
      return { deletedFiles, errors };
    } catch (error) {
      this.logger.error('Error during cleanup:', error);
      throw error;
    }
  }
}
