import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BannerDocument = Banner & Document;

@Schema({ timestamps: true })
export class Banner {
  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop()
  link: string;

  @Prop()
  ctaText: string;

  @Prop({ required: true })
  desktopMedia: string;

  @Prop({ required: true, enum: ['image', 'video'] })
  desktopMediaType: 'image' | 'video';

  @Prop()
  mobileMedia: string;

  @Prop({ enum: ['image', 'video'] })
  mobileMediaType: 'image' | 'video';

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  displayOrder: number;
}

export const BannerSchema = SchemaFactory.createForClass(Banner);
