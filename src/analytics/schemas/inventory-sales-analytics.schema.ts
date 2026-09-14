import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InventorySalesAnalyticsDocument = InventorySalesAnalytics &
  Document;

@Schema({ timestamps: true })
export class InventorySalesAnalytics {
  @Prop({ type: Types.ObjectId, ref: 'ShopProduct', required: true })
  productId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ShopCategory', required: true })
  categoryId: Types.ObjectId;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true, default: 0 })
  quantitySold: number;

  @Prop({ required: true, default: 0 })
  revenue: number;
}

export const InventorySalesAnalyticsSchema = SchemaFactory.createForClass(
  InventorySalesAnalytics,
);

// Index for performant historical queries
InventorySalesAnalyticsSchema.index({ date: 1, productId: 1 });
InventorySalesAnalyticsSchema.index({ categoryId: 1, date: 1 });
