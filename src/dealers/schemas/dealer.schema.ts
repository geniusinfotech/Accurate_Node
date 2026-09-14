import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DealerDocument = Dealer & Document;

@Schema({ timestamps: true })
export class Dealer {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '' })
  phone: string;

  @Prop({ default: '' })
  address: string;

  @Prop({ default: '' })
  notes: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const DealerSchema = SchemaFactory.createForClass(Dealer);
