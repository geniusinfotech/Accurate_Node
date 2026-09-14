import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ScrapedProductDocument = ScrapedProduct & Document;

@Schema({ timestamps: true })
export class ScrapedProduct {
  @Prop({ required: true })
  title: string;

  @Prop()
  brand: string;

  @Prop({ type: Number })
  price: number;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: Map, of: String, default: {} })
  specifications: Map<string, string>;

  @Prop()
  sourceUrl: string;
}

export const ScrapedProductSchema =
  SchemaFactory.createForClass(ScrapedProduct);
