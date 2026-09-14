import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BotQaDocument = BotQa & Document;

@Schema({ timestamps: true })
export class BotQa {
  @Prop({ required: true })
  question: string;

  @Prop({ required: true })
  answer: string;

  @Prop({ type: [String], default: [], index: true })
  keywords: string[];

  @Prop({ default: true })
  isActive: boolean;
}

export const BotQaSchema = SchemaFactory.createForClass(BotQa);

BotQaSchema.index({ question: 'text' });
