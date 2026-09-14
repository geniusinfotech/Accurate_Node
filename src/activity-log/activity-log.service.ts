import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ActivityLog,
  ActivityLogDocument,
} from './schemas/activity-log.schema';

export interface FindAllActivityLogFilters {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  actorRole?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface ActivityLogPage {
  items: ActivityLog[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateActivityLogDto {
  actorId: string | Types.ObjectId;
  actorName: string;
  actorRole?: string;
  action: 'create' | 'update' | 'delete' | 'mark_done';
  entityType: string;
  entityId: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
}

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectModel(ActivityLog.name)
    private activityLogModel: Model<ActivityLogDocument>,
  ) {}

  async createLog(dto: CreateActivityLogDto): Promise<ActivityLogDocument> {
    const log = new this.activityLogModel({
      ...dto,
      actorId:
        typeof dto.actorId === 'string'
          ? new Types.ObjectId(dto.actorId)
          : dto.actorId,
      timestamp: new Date(),
    });
    return log.save();
  }

  async findAll(filters: FindAllActivityLogFilters): Promise<ActivityLogPage> {
    const query: any = {};
    if (filters.entityType) {
      query.entityType = filters.entityType;
    }
    if (filters.entityId) {
      query.entityId = filters.entityId;
    }
    if (filters.actorId) {
      query.actorId = new Types.ObjectId(filters.actorId);
    }
    if (filters.actorRole) {
      query.actorRole = filters.actorRole;
    }
    if (filters.action) {
      query.action = filters.action;
    }
    if (filters.from || filters.to) {
      query.timestamp = this.buildTimestampRange(filters.from, filters.to);
    }

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(200, Math.max(1, filters.limit || 50));

    const [items, total] = await Promise.all([
      this.activityLogModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.activityLogModel.countDocuments(query).exec(),
    ]);

    return { items, total, page, limit };
  }

  private buildTimestampRange(
    from?: string,
    to?: string,
  ): {
    $gte?: Date;
    $lte?: Date;
  } {
    const parse = (value?: string): Date | undefined => {
      if (!value) return undefined;
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
      const date = match
        ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
        : new Date(value);
      return isNaN(date.getTime()) ? undefined : date;
    };

    const range: { $gte?: Date; $lte?: Date } = {};
    if (from) {
      const start = parse(from);
      if (start) {
        start.setHours(0, 0, 0, 0);
        range.$gte = start;
      }
    }
    if (to) {
      const end = parse(to);
      if (end) {
        end.setHours(23, 59, 59, 999);
        range.$lte = end;
      }
    }
    return range;
  }
}
