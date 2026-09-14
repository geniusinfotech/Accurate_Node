import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ShopCategoryDocument = ShopCategory & Document;

@Schema({ timestamps: true, collection: 'shop_categories' })
export class ShopCategory {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop()
  description: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  showOnHomepage: boolean;

  @Prop()
  homepageCoverImage: string;
}

export const ShopCategorySchema = SchemaFactory.createForClass(ShopCategory);
