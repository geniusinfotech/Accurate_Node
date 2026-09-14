import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Admin, AdminDocument } from './schema/admin.schema';
import { User, UserDocument } from '../users/schema/user.schema';
import { CreateAdminDto } from './dto/create-admin.dto';
import { Role } from '../auth/roles.enum';

@Injectable()
export class AdminsService {
  constructor(
    @InjectModel(Admin.name) private adminModel: Model<AdminDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(createAdminDto: CreateAdminDto): Promise<AdminDocument> {
    const { password, email, ...rest } = createAdminDto;

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
      roles: [Role.ADMIN],
    });
    const savedUser = await user.save();

    // Create Admin Profile
    const admin = new this.adminModel({
      user: savedUser._id,
      settings: createAdminDto.settings || {},
      status: 'active',
    });

    return (await admin.save()).populate('user', 'firstname lastname email');
  }

  async findByUserId(userId: string): Promise<AdminDocument | null> {
    return this.adminModel.findOne({ user: new Types.ObjectId(userId) }).exec();
  }

  async updateSettings(userId: string, settings: Record<string, any>) {
    return this.adminModel
      .findOneAndUpdate(
        { user: new Types.ObjectId(userId) },
        { $set: { settings } },
        { upsert: true, new: true },
      )
      .exec();
  }

  async findAll() {
    // 1. Find all users who have the 'admin' role
    const adminUsers = await this.userModel.find({ roles: Role.ADMIN }).exec();

    // 2. For each such user, find or create their Admin profile
    const admins = await Promise.all(
      adminUsers.map(async (user) => {
        let adminProfile = await this.adminModel
          .findOne({ user: user._id })
          .exec();

        if (!adminProfile) {
          // Auto-create profile if missing
          adminProfile = new this.adminModel({
            user: user._id,
            settings: {},
            status: 'active',
          });
          await adminProfile.save();
        }

        // Return populated profile
        return adminProfile.populate('user', 'firstname lastname email');
      }),
    );

    return admins;
  }

  async findOne(id: string) {
    // Try finding by Admin document ID first
    let admin = await this.adminModel
      .findById(id)
      .populate('user', 'firstname lastname email')
      .exec();

    // If not found, try finding by linked User ID
    if (!admin) {
      admin = await this.adminModel
        .findOne({ user: new Types.ObjectId(id) })
        .populate('user', 'firstname lastname email')
        .exec();
    }

    if (!admin) {
      // Check if it's a user with admin role but no profile yet
      const user = await this.userModel
        .findOne({ _id: new Types.ObjectId(id), roles: Role.ADMIN })
        .exec();
      if (user) {
        admin = new this.adminModel({
          user: user._id,
          settings: {},
          status: 'active',
        });
        await admin.save();
        return admin.populate('user', 'firstname lastname email');
      }
      throw new NotFoundException('Admin not found');
    }
    return admin;
  }

  async updateStatus(userId: string, status: 'active' | 'inactive') {
    return this.adminModel
      .findOneAndUpdate(
        { user: new Types.ObjectId(userId) },
        { $set: { status } },
        { upsert: true, new: true },
      )
      .exec();
  }
}
