/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schema/user.schema';

export type AdminDocument = Admin & Document;

@Schema({ timestamps: true })
export class Admin {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
    user: User | Types.ObjectId;

    @Prop({ type: Object, default: {} })
    settings: Record<string, any>;

    @Prop({ default: 'active' })
    status: 'active' | 'inactive';
}

export const AdminSchema = SchemaFactory.createForClass(Admin);
