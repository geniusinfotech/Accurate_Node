import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CashBankAccountDocument = CashBankAccount & Document;

@Schema({ timestamps: true })
export class CashBankAccount {
  @Prop({ required: true, trim: true, unique: true })
  name: string;

  @Prop({ required: true, enum: ['cash', 'bank'] })
  type: 'cash' | 'bank';

  @Prop({ default: '' })
  bankName: string;

  @Prop({ default: '' })
  accountNumber: string;

  @Prop({ default: '' })
  ifsc: string;

  @Prop({ default: '' })
  branch: string;

  @Prop({ default: 0 })
  openingBalance: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: '' })
  notes: string;
}

export const CashBankAccountSchema =
  SchemaFactory.createForClass(CashBankAccount);
