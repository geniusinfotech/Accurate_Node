import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ExcelUploadHistoryDocument = ExcelUploadHistory & Document;

export interface ValidationErrorEntry {
  row: number;
  error: string;
}

@Schema({ timestamps: true })
export class ExcelUploadHistory {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Brand', required: true })
  brandId: MongooseSchema.Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Category',
    required: true,
  })
  categoryId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  fileName: string;

  @Prop({ required: true })
  filePath: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  uploadedBy: MongooseSchema.Types.ObjectId;

  @Prop({ default: 0 })
  uploadedProducts: number;

  @Prop({ default: 0 })
  failedCount: number;

  @Prop({
    type: String,
    enum: ['validated', 'completed', 'failed'],
    default: 'completed',
  })
  status: string;

  @Prop({ type: [{ row: Number, error: String }], default: [] })
  validationErrors: ValidationErrorEntry[];

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const ExcelUploadHistorySchema =
  SchemaFactory.createForClass(ExcelUploadHistory);

// Create indexes for cleanup cron job
ExcelUploadHistorySchema.index({ createdAt: 1 });
ExcelUploadHistorySchema.index({ status: 1 });
