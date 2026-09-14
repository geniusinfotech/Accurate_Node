import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ShopBrandDocument = ShopBrand & Document;

@Schema({ timestamps: true, collection: 'shop_brands' })
export class ShopBrand {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true, unique: true, uppercase: true })
  code: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const ShopBrandSchema = SchemaFactory.createForClass(ShopBrand);
