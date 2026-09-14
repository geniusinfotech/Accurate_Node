import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type WorkerPaymentDocument = WorkerPayment & Document;

@Schema({ timestamps: true })
export class WorkerPayment {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Worker', required: true })
  workerId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'WorkBatch' })
  workBatchId?: MongooseSchema.Types.ObjectId;

  @Prop({ default: 0, min: 0 })
  amountDue: number;

  @Prop({ default: 0, min: 0 })
  amountPaid: number;

  @Prop({ default: 0, min: 0 })
  advance: number;

  @Prop({ default: 0, min: 0 })
  deduction: number;

  @Prop({ required: true, default: Date.now })
  date: Date;

  @Prop({ required: true, enum: ['cash', 'bank', 'upi'], default: 'cash' })
  mode: string;

  @Prop()
  remarks?: string;
}

export const WorkerPaymentSchema = SchemaFactory.createForClass(WorkerPayment);
