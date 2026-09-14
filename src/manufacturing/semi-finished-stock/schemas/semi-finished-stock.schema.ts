import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type SemiFinishedStockDocument = SemiFinishedStock & Document;

@Schema({ timestamps: true })
export class SemiFinishedStock {
  @Prop({ required: true })
  stage: string; // e.g., 'chain', 'polish', 'packing'

  @Prop({ required: true, min: 0 })
  quantity: number; // kg or pcs

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'RawMaterial' })
  rawMaterialId?: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'WorkBatch' })
  batchId?: MongooseSchema.Types.ObjectId;

  @Prop({ index: true, sparse: true })
  lotId?: string;

  @Prop({
    required: true,
    enum: ['ready', 'processing', 'completed', 'published'],
    default: 'ready',
  })
  status: string;

  // Why the quantity last moved by hand — carries the write-off reason, the
  // same way raw-material lots do.
  @Prop({ default: '' })
  notes: string;
}

export const SemiFinishedStockSchema =
  SchemaFactory.createForClass(SemiFinishedStock);
