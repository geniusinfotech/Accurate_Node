/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schema/user.schema';

export type ManagerDocument = Manager & Document;

@Schema({ timestamps: true })
export class Manager {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
    user: User | Types.ObjectId;

    @Prop({ type: [String], default: [] })
    permissions: string[];

    @Prop({ type: [String], default: [] })
    dashboardWidgets: string[];

    @Prop({ default: 'active' })
    status: 'active' | 'inactive';
}

export const ManagerSchema = SchemaFactory.createForClass(Manager);
