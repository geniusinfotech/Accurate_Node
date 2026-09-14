import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExcelCleanupService } from '../services/excel-cleanup.service';

@Injectable()
export class ExcelCleanupCron {
  private readonly logger = new Logger(ExcelCleanupCron.name);

  constructor(private readonly excelCleanupService: ExcelCleanupService) {}

  /**
   * Run cleanup daily at 2 AM
   * Cron expression: 0 2 * * * (every day at 2:00 AM)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleCleanup() {
    this.logger.log('Starting scheduled Excel cleanup job');

    try {
      const result = await this.excelCleanupService.cleanupOldUploads();

      this.logger.log(
        `Cleanup job completed: ${result.deletedFiles} files deleted, ${result.errors.length} errors`,
      );

      if (result.errors.length > 0) {
        this.logger.warn('Cleanup errors:', result.errors);
      }
    } catch (error) {
      this.logger.error('Cleanup job failed:', error);
    }
  }
}
