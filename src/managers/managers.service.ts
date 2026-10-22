import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Manager, ManagerDocument } from './schema/manager.schema';
import { User, UserDocument } from '../users/schema/user.schema';
import { CreateManagerDto } from './dto/create-manager.dto';
import { Role } from '../auth/roles.enum';
import { Permission } from '../auth/permissions.enum';

@Injectable()
export class ManagersService {
  constructor(
    @InjectModel(Manager.name) private managerModel: Model<ManagerDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(createManagerDto: CreateManagerDto): Promise<ManagerDocument> {
    const { password, email, ...rest } = createManagerDto;

    // Check if user already exists
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create User
    const user = new this.userModel({
      ...rest,
      email,
      password: hashedPassword,
      roles: [Role.MANAGER],
    });
    const savedUser = await user.save();

    // Create Manager Profile
    const manager = new this.managerModel({
      user: savedUser._id,
      permissions: createManagerDto.permissions || [],
      dashboardWidgets: createManagerDto.dashboardWidgets || [],
      status: 'active',
    });

    return (await manager.save()).populate('user', 'firstname lastname email');
  }

  async findByUserId(userId: string): Promise<ManagerDocument | null> {
    return this.managerModel
      .findOne({ user: new Types.ObjectId(userId) })
      .exec();
  }

  async createOrUpdateManager(userId: string, data: Partial<Manager>) {
    return this.managerModel
      .findOneAndUpdate(
        { user: new Types.ObjectId(userId) },
        { $set: data },
        { upsert: true, new: true },
      )
      .exec();
  }

  async updatePermissions(userId: string, permissions: Permission[]) {
    const manager = await this.managerModel
      .findOneAndUpdate(
        { user: new Types.ObjectId(userId) },
        { $set: { permissions } },
        { upsert: true, new: true },
      )
      .exec();
    return manager;
  }

  async updateWidgets(userId: string, dashboardWidgets: string[]) {
    const manager = await this.managerModel
      .findOneAndUpdate(
        { user: new Types.ObjectId(userId) },
        { $set: { dashboardWidgets } },
        { upsert: true, new: true },
      )
      .exec();
    return manager;
  }

  async resetPassword(userId: string, password: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.roles.includes(Role.MANAGER)) {
      throw new BadRequestException('Only manager passwords can be reset here');
    }
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();
    return { success: true, message: 'Password updated successfully' };
  }

  async removeByUserId(userId: string) {
    const userIdObj = new Types.ObjectId(userId);
    await this.managerModel.deleteMany({ user: userIdObj }).exec();
    const deleted = await this.userModel.findByIdAndDelete(userId).exec();
    if (!deleted) {
      throw new NotFoundException('Manager not found');
    }
    return { success: true, message: 'Manager removed successfully' };
  }

  async findAll() {
    // 1. Find all users who have the 'manager' role
    const managerUsers = await this.userModel
      .find({ roles: Role.MANAGER })
      .exec();

    // 2. For each such user, find or create their Manager profile
    const managers = await Promise.all(
      managerUsers.map(async (user) => {
        let managerProfile = await this.managerModel
          .findOne({ user: user._id })
          .exec();

        if (!managerProfile) {
          // Auto-create profile if missing (e.g., if user was created via generic register)
          managerProfile = new this.managerModel({
            user: user._id,
            permissions: [],
            dashboardWidgets: [],
            status: 'active',
          });
          await managerProfile.save();
        }

        // Return populated profile
        return managerProfile.populate('user', 'firstname lastname email');
      }),
    );

    return managers;
  }

  async findOne(id: string) {
    // Try finding by Manager document ID first
    let manager = await this.managerModel
      .findById(id)
      .populate('user', 'firstname lastname email')
      .exec();

    // If not found, try finding by linked User ID
    if (!manager) {
      manager = await this.managerModel
        .findOne({ user: new Types.ObjectId(id) })
        .populate('user', 'firstname lastname email')
        .exec();
    }

    if (!manager) {
      // Check if it's a user with manager role but no profile yet
      const user = await this.userModel
        .findOne({ _id: new Types.ObjectId(id), roles: Role.MANAGER })
        .exec();
      if (user) {
        manager = new this.managerModel({
          user: user._id,
          permissions: [],
          dashboardWidgets: [],
          status: 'active',
        });
        await manager.save();
        return manager.populate('user', 'firstname lastname email');
      }
      throw new NotFoundException('Manager not found');
    }
    return manager;
  }
}
