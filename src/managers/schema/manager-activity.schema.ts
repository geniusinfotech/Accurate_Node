/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ManagerActivityDocument = ManagerActivity & Document;

@Schema({ timestamps: true })
export class ManagerActivity {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    managerId: Types.ObjectId;

    @Prop({ required: true })
    loginAt: Date;

    @Prop({ required: false })
    logoutAt: Date;

    @Prop({ default: 0 })
    activeMinutes: number;

    @Prop({ default: 0 })
    idleMinutes: number;

    @Prop({ required: true })
    lastHeartbeatAt: Date;
}

export const ManagerActivitySchema = SchemaFactory.createForClass(ManagerActivity);
