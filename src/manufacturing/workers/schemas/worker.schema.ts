import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WorkerDocument = Worker & Document;

@Schema({ _id: false })
export class RateConfig {
  @Prop({ default: 0 })
  perKg: number;

  @Prop({ default: 0 })
  perPcs: number;
}

@Schema({ timestamps: true })
export class Worker {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  phone: string;

  // Workers are one shared pool — the same person can be given kg work or
  // piece work — so they are no longer pinned to a chain/polish/refine/packing
  // category. Kept as a free-text label for records created before that.
  @Prop({ default: '' })
  type?: string;

  @Prop({ type: RateConfig, default: () => ({ perKg: 0, perPcs: 0 }) })
  rateConfig: RateConfig;

  @Prop({ default: 'active', enum: ['active', 'inactive'] })
  status: string;
}

export const WorkerSchema = SchemaFactory.createForClass(Worker);
