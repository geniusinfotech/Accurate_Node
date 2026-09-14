import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ExcelUploadHistoryDocument = ExcelUploadHistory & Document;

export interface ValidationErrorEntry {
  row: number;
  error: string;
}

@Schema({ timestamps: true })
export class ExcelUploadHistory {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'ShopBrand',
    required: true,
  })
  shopBrandId: MongooseSchema.Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'ShopCategory',
    required: true,
  })
  shopCategoryId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  fileName: string;

  @Prop({ required: true })
  filePath: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  uploadedBy: MongooseSchema.Types.ObjectId;

  @Prop({ default: 0 })
  uploadedShopProducts: number;

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
