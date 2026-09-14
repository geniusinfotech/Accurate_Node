import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type CashBankEntryDocument = CashBankEntry & Document;

@Schema({ timestamps: true })
export class CashBankEntry {
  @Prop({ required: true, enum: ['receipt', 'payment'] })
  voucherType: 'receipt' | 'payment';

  @Prop({ default: Date.now })
  date: Date;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'CashBankAccount',
    required: true,
  })
  accountId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ default: 'cash' })
  mode: string;

  @Prop({ default: '' })
  notes: string;

  @Prop({ enum: ['dealer', 'customer', 'worker', 'other'], default: 'other' })
  refType: 'dealer' | 'customer' | 'worker' | 'other';

  @Prop({ default: '' })
  refId: string;

  @Prop({ default: '' })
  refName: string;

  @Prop({ default: false })
  cancelled: boolean;
}

export const CashBankEntrySchema = SchemaFactory.createForClass(CashBankEntry);

CashBankEntrySchema.index({ accountId: 1, date: 1 });
