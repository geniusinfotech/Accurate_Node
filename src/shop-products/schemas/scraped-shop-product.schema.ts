import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ScrapedShopProductDocument = ScrapedShopProduct & Document;

@Schema({ timestamps: true })
export class ScrapedShopProduct {
  @Prop({ required: true })
  title: string;

  @Prop()
  shopBrand: string;

  @Prop({ type: Number })
  price: number;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: Map, of: String, default: {} })
  specifications: Map<string, string>;

  @Prop()
  sourceUrl: string;
}

export const ScrapedShopProductSchema =
  SchemaFactory.createForClass(ScrapedShopProduct);
