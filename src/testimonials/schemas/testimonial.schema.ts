/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TestimonialDocument = Testimonial & Document;

@Schema({ timestamps: true })
export class Testimonial {
  @Prop({ required: true })
  text: string;

  @Prop()
  image?: string;

  @Prop()
  videoLink?: string;

  @Prop()
  youtubeUrl?: string;  // YouTube video URL

  @Prop({ default: 0 })
  sortOrder: number;  // For manual sorting (lower numbers appear first)

  @Prop({ required: true })
  customerName: string;

  @Prop({ required: true })
  customerPost: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const TestimonialSchema = SchemaFactory.createForClass(Testimonial);
