import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type RawMaterialDocument = RawMaterial & Document;

@Schema({ timestamps: true })
export class RawMaterial {
  @Prop({ required: true })
  materialName: string;

  @Prop({ default: '' })
  dealerName: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Dealer', required: false })
  dealerId?: Types.ObjectId;

  @Prop({ index: true, sparse: true })
  lotId?: string;

  // How the lot arrived. Stock is always carried in kg — `unit` only records
  // whether the dealer billed it as loose weight or as rolls, so the roll
  // count can be shown back on the stock screens.
  @Prop({ default: 'kg', enum: ['kg', 'roll'] })
  unit: string;

  // Roll count as it came in on the bill (0 when the lot was bought by weight).
  @Prop({ default: 0, min: 0 })
  rolls: number;

  // Weight of a single roll, so remaining rolls can be derived from the
  // remaining quantity as stock gets issued out.
  @Prop({ default: 0, min: 0 })
  kgPerRoll: number;

  @Prop({ required: true, min: 0 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  pricePerKg: number;

  @Prop({ required: true, min: 0 })
  totalAmount: number;

  @Prop({ default: '' })
  reference: string;

  @Prop({ default: '' })
  notes: string;

  @Prop({ default: new Date() })
  purchaseDate: Date;
}

export const RawMaterialSchema = SchemaFactory.createForClass(RawMaterial);
