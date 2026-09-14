import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type SaleDocument = Sale & Document;

@Schema({ _id: false })
export class SaleItem {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  sku?: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, min: 0 })
  subtotal: number;
}

export const SaleItemSchema = SchemaFactory.createForClass(SaleItem);

@Schema({ timestamps: true })
export class Sale {
  @Prop({
    required: true,
    unique: true,
    index: true,
    uppercase: true,
    trim: true,
  })
  saleNumber: string;

  @Prop({ default: '' })
  customerName: string;

  @Prop({ default: '' })
  phone: string;

  @Prop({ default: '' })
  shopName: string;

  @Prop({ type: [SaleItemSchema], default: [] })
  items: SaleItem[];

  @Prop({ required: true, min: 0 })
  totalAmount: number;

  @Prop({ default: 0, min: 0 })
  discount: number;

  @Prop({ default: 0, min: 0 })
  freight: number;

  @Prop({
    type: String,
    enum: ['cash', 'upi', 'card', 'credit', 'other'],
    default: 'cash',
  })
  paymentMode: string;

  @Prop({ required: true, min: 0 })
  amountPaid: number;

  @Prop({ default: 0, min: 0 })
  balanceDue: number;

  @Prop({ default: new Date() })
  saleDate: Date;

  @Prop({ default: '' })
  notes: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: false })
  createdBy?: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Customer',
    required: false,
    index: true,
  })
  customerId?: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Dealer',
    required: false,
    index: true,
  })
  dealerId?: Types.ObjectId;
}

export const SaleSchema = SchemaFactory.createForClass(Sale);

SaleSchema.index({ saleDate: -1 });
SaleSchema.index({ shopName: 1 });
SaleSchema.index({ customerId: 1, saleDate: -1 });
SaleSchema.index({ dealerId: 1, saleDate: -1 });
