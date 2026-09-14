import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ActivityLogDocument = ActivityLog & Document;

@Schema({ timestamps: true })
export class ActivityLog {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  actorId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  actorName: string;

  @Prop({ required: false, default: 'admin' })
  actorRole: string;

  @Prop({ required: true, enum: ['create', 'update', 'delete', 'mark_done'] })
  action: 'create' | 'update' | 'delete' | 'mark_done';

  @Prop({ required: true })
  entityType: string;

  @Prop({ required: true })
  entityId: string;

  @Prop({ type: Object })
  before?: Record<string, any>;

  @Prop({ type: Object })
  after?: Record<string, any>;

  @Prop({ type: [MongooseSchema.Types.Mixed] })
  changes?: Array<{ field: string; from: any; to: any }>;

  @Prop({ type: String })
  summary?: string;

  @Prop({ default: Date.now })
  timestamp: Date;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);
