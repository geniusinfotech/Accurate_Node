import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type CustomerLedgerDocument = CustomerLedger & Document;

@Schema({ timestamps: true })
export class CustomerLedger {
  @Prop({ required: true, index: true, trim: true })
  customerName: string;

  @Prop({ default: '' })
  phone: string;

  @Prop({ required: true, index: true, enum: ['sale', 'payment'] })
  type: 'sale' | 'payment';

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Sale', required: false })
  refSaleId?: Types.ObjectId;

  @Prop({ default: Date.now, index: true })
  date: Date;

  @Prop({ default: 'cash' })
  mode: string;

  @Prop({ default: '' })
  notes: string;
}

export const CustomerLedgerSchema =
  SchemaFactory.createForClass(CustomerLedger);

CustomerLedgerSchema.index({ customerName: 1, phone: 1, date: -1 });
