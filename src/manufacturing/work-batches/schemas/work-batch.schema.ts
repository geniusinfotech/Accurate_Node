import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type WorkBatchDocument = WorkBatch & Document;

@Schema({ timestamps: true })
export class WorkBatchCompletion {
  @Prop({ default: Date.now })
  date: Date;

  @Prop({ default: 0, min: 0 })
  pcsReturned: number;

  @Prop({ default: 0, min: 0 })
  weightReturned: number;

  @Prop({ default: 0, min: 0 })
  defectCount: number;

  @Prop({ default: '' })
  note: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'SemiFinishedStock' })
  addedToStockId?: MongooseSchema.Types.ObjectId;
}

export const WorkBatchCompletionSchema =
  SchemaFactory.createForClass(WorkBatchCompletion);

@Schema({ timestamps: true })
export class WorkBatch {
  @Prop({
    required: true,
    enum: ['raw->chain', 'chain->polish', 'polish->packing', 'polish->refine'],
  })
  stage: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Worker', required: true })
  workerId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'RawMaterial' })
  rawMaterialId?: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'SemiFinishedStock' })
  semiFinishedStockId?: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'WorkBatch' })
  parentBatchId?: MongooseSchema.Types.ObjectId;

  @Prop({ index: true, sparse: true })
  lotId?: string;

  @Prop({ required: true, min: 0 })
  kgGivenOut: number;

  @Prop({ default: 0, min: 0 })
  pcsGivenOut: number;

  @Prop({ default: 0, min: 0 })
  returnedQuantity: number;

  @Prop({ default: 0, min: 0 })
  returnedPcs: number;

  @Prop({ default: 0, min: 0 })
  returnedWeight: number;

  @Prop({ default: 0, min: 0 })
  defectCount: number;

  @Prop({ default: 0, min: 0 })
  lossPercent: number;

  @Prop({ type: [WorkBatchCompletionSchema], default: [] })
  completions: WorkBatchCompletion[];

  @Prop({ default: '' })
  workType: string;

  @Prop({ default: '' })
  productGender: string;

  @Prop({ default: '' })
  finishProductName: string;

  @Prop({ default: 0, min: 0 })
  makingChargePerPcs: number;

  @Prop({ default: 0, min: 0 })
  totalMakingCharge: number;

  @Prop({ default: '' })
  assignNotes: string;

  @Prop({ default: '' })
  returnNotes: string;

  @Prop({ required: true, default: Date.now })
  dateOut: Date;

  @Prop()
  dateIn?: Date;

  @Prop({
    required: true,
    enum: ['out', 'returned', 'partial'],
    default: 'out',
  })
  status: string;
}

export const WorkBatchSchema = SchemaFactory.createForClass(WorkBatch);
