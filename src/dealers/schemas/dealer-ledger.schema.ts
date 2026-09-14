import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type DealerLedgerDocument = DealerLedger & Document;

@Schema({ timestamps: true })
export class DealerLedger {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Dealer', required: true })
  dealerId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, enum: ['purchase', 'payment'] })
  type: 'purchase' | 'payment';

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'RawMaterial',
    required: false,
  })
  refPurchaseId?: MongooseSchema.Types.ObjectId;

  @Prop({ default: Date.now })
  date: Date;

  @Prop({ default: 'cash' })
  mode: string;

  @Prop({ default: '' })
  notes: string;
}

export const DealerLedgerSchema = SchemaFactory.createForClass(DealerLedger);
