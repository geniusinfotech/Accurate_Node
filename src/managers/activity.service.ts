import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schema/user.schema';
import {
  ManagerActivity,
  ManagerActivityDocument,
} from './schema/manager-activity.schema';

@Injectable()
export class ActivityService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(ManagerActivity.name)
    private activityModel: Model<ManagerActivityDocument>,
  ) {}

  async updateActivity(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) return;

    const now = new Date();
    const previousActivityAt = user.lastActivityAt
      ? new Date(user.lastActivityAt)
      : now;
    user.lastActivityAt = now;
    await user.save();

    // Also update ManagerActivity if it's a manager
    // Note: In roles.enum.ts, MANAGER is 'manager'
    if (user.roles.includes('manager' as any)) {
      await this.trackManagerActivity(userId, now, previousActivityAt);
    }
  }

  private async trackManagerActivity(
    userId: string,
    now: Date,
    previousActivityAt: Date,
  ) {
    let activity = await this.activityModel
      .findOne({
        managerId: new Types.ObjectId(userId),
        logoutAt: { $exists: false },
      })
      .sort({ loginAt: -1 });

    if (!activity) {
      // Create new session if none exists (e.g. if logout logic missed something or first request)
      activity = new this.activityModel({
        managerId: new Types.ObjectId(userId),
        loginAt: now,
        lastHeartbeatAt: now,
      });
      await activity.save();
      return;
    }

    const idleThreshold = 5 * 60 * 1000; // 5 minutes
    const diffMs = now.getTime() - new Date(activity.lastHeartbeatAt).getTime();

    // If gap between this request and last activity is > 5 mins, it's idle time
    if (diffMs > idleThreshold) {
      activity.idleMinutes += diffMs / (60 * 1000);
    } else {
      activity.activeMinutes += diffMs / (60 * 1000);
    }

    activity.lastHeartbeatAt = now;
    await activity.save();
  }

  async handleLogin(userId: string) {
    const now = new Date();
    await this.userModel.findByIdAndUpdate(userId, {
      lastLoginAt: now,
      lastActivityAt: now,
    });

    // Check for any unclosed sessions and close them
    await this.activityModel.updateMany(
      { managerId: new Types.ObjectId(userId), logoutAt: { $exists: false } },
      { $set: { logoutAt: now } },
    );

    // Start new manager activity session
    const activity = new this.activityModel({
      managerId: new Types.ObjectId(userId),
      loginAt: now,
      lastHeartbeatAt: now,
    });
    await activity.save();
  }

  async handleLogout(userId: string) {
    const now = new Date();
    await this.activityModel.updateMany(
      { managerId: new Types.ObjectId(userId), logoutAt: { $exists: false } },
      { $set: { logoutAt: now } },
    );
  }

  async getManagerReport(managerId: string, startDate: Date, endDate: Date) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const sessions = await this.activityModel
      .find({
        managerId: new Types.ObjectId(managerId),
        loginAt: { $gte: start, $lte: end },
      })
      .exec();

    let totalActiveMinutes = 0;
    let totalIdleMinutes = 0;

    sessions.forEach((session) => {
      totalActiveMinutes += session.activeMinutes;
      totalIdleMinutes += session.idleMinutes;
    });

    return {
      managerId,
      totalHours: (totalActiveMinutes + totalIdleMinutes) / 60,
      activeHours: totalActiveMinutes / 60,
      idleHours: totalIdleMinutes / 60,
      sessionCount: sessions.length,
      sessions: sessions
        .map((s) => ({
          loginAt: s.loginAt,
          logoutAt: s.logoutAt,
          activeMinutes: s.activeMinutes,
          idleMinutes: s.idleMinutes,
        }))
        .sort((a, b) => b.loginAt.getTime() - a.loginAt.getTime()),
    };
  }

  async getAllManagersReport(
    startDate: Date,
    endDate: Date,
    managerId?: string,
  ) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const matchStage: any = {
      loginAt: { $gte: start, $lte: end },
    };

    if (managerId) {
      matchStage.managerId = new Types.ObjectId(managerId);
    }

    const reports = await this.activityModel.aggregate([
      {
        $match: matchStage,
      },
      {
        $group: {
          _id: '$managerId',
          totalActiveMinutes: { $sum: '$activeMinutes' },
          totalIdleMinutes: { $sum: '$idleMinutes' },
          sessionCount: { $sum: 1 },
          minLoginAt: { $min: '$loginAt' },
          maxLogoutAt: { $max: '$logoutAt' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
      // Filter to only include managers (exclude admins and regular users)
      {
        $match: {
          'user.roles': 'manager',
        },
      },
      {
        $project: {
          managerId: '$_id',
          manager: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: ['$user.firstname', ''] },
                  ' ',
                  { $ifNull: ['$user.lastname', ''] },
                ],
              },
            },
          },
          role: { $literal: 'manager' },
          totalHours: {
            $divide: [
              { $add: ['$totalActiveMinutes', '$totalIdleMinutes'] },
              60,
            ],
          },
          activeHours: { $divide: ['$totalActiveMinutes', 60] },
          idleHours: { $divide: ['$totalIdleMinutes', 60] },
          sessionCount: 1,
          loginAt: '$minLoginAt',
          logoutAt: '$maxLogoutAt',
        },
      },
    ]);

    return reports.map((report: any) => ({
      ...report,
      manager:
        (typeof report.manager === 'string' && report.manager.trim()) ||
        `Manager ${String(report.managerId || '').slice(-6)}`,
    }));
  }
}
