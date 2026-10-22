import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ContactDocument = Contact & Document;

export enum ContactStatus {
  UNREAD = 'unread',
  READ = 'read',
  REPLIED = 'replied',
}

@Schema({ timestamps: true })
export class Contact {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, lowercase: true })
  email: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ default: 'General Inquiry', trim: true })
  subject: string;

  @Prop({ required: true, trim: true })
  message: string;

  @Prop({
    type: String,
    enum: Object.values(ContactStatus),
    default: ContactStatus.UNREAD,
  })
  status: ContactStatus;

  @Prop({ default: '', trim: true })
  notes?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ContactSchema = SchemaFactory.createForClass(Contact);
