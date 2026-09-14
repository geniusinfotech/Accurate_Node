import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CouponDocument = Coupon & Document;

export enum DiscountType {
  FIXED = 'fixed',
  PERCENT = 'percent',
}

@Schema({ timestamps: true })
export class Coupon {
  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ required: true })
  discountValue: number;

  @Prop({ required: true, enum: DiscountType, default: DiscountType.FIXED })
  discountType: DiscountType;

  @Prop({ default: 0 })
  minSpendGoal: number; // The goal amount for user to unlock/use this

  @Prop()
  validFrom: Date;

  @Prop()
  validUntil: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isAutoApplied: boolean;
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);
