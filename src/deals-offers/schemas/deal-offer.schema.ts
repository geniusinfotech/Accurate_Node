import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DealOfferDocument = DealOffer & Document;

@Schema({ timestamps: true })
export class DealOffer {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  discountPercentage: number;

  @Prop()
  couponCode?: string;

  @Prop({ required: true })
  validFrom: Date;

  @Prop({ required: true })
  validUntil: Date;

  @Prop()
  image?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Product' }], default: [] })
  targetProducts?: Types.ObjectId[]; // Optional: specific products

  @Prop({ type: [String], default: [] })
  targetCategories?: string[]; // Optional: specific categories
}

export const DealOfferSchema = SchemaFactory.createForClass(DealOffer);
