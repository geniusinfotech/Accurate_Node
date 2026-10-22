/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schema/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { Role } from '../auth/roles.enum';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) { }

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    const created = new this.userModel(createUserDto);
    return created.save();
  }

  async createWithHash(createUserDto: any): Promise<UserDocument> {
    const bcrypt = require('bcrypt');
    const salt = await bcrypt.genSalt(12);
    createUserDto.password = await bcrypt.hash(createUserDto.password, salt);
    const created = new this.userModel(createUserDto);
    return created.save();
  }

  async findByEmail(email: string): Promise<UserDocument | undefined> {
    const normalized = email.toLowerCase().trim();
    return (await this.userModel
      .findOne({ email: normalized })) || undefined;
  }

  async findById(id: string): Promise<UserDocument | undefined> {
    const user = await this.userModel.findById(id).catch(() => {
      throw new InternalServerErrorException('Could not retrieve user');
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateActivity(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { lastActivityAt: new Date() });
  }

  async updateRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
    if (!refreshToken) {
      await this.userModel.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: 1 } });
      return;
    }
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.userModel.findByIdAndUpdate(userId, { refreshTokenHash: hash });
  }

  async verifyRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
    const user = await this.userModel.findById(userId);
    if (!user || !user.refreshTokenHash) return false;
    const bcrypt = require('bcrypt');
    return bcrypt.compare(refreshToken, user.refreshTokenHash);
  }

  async findAll(): Promise<User[]> {
    return this.excludeSensitiveData(this.userModel.find().select('-resetPasswordToken -resetPasswordExpires -refreshTokenHash -googleId -githubId'));
  }

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.userModel.findByIdAndDelete(id);
      if (!result) {
        return { success: false, message: 'User not found' };
      }
      return { success: true, message: 'User removed successfully' };
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error('Could not delete user');
    }
  }

  async updateStatus(id: string, isActive: boolean): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(id, { isActive }, { new: true });
  }

  async updateRoles(id: string, roles: Role[]): Promise<UserDocument | null> {
    const allowed = Object.values(Role) as string[];
    const clean = Array.isArray(roles) ? roles.filter(r => allowed.includes(r as string)) : [];
    if (clean.length === 0) throw new Error('Invalid roles');
    return this.userModel.findByIdAndUpdate(id, { roles: clean }, { new: true });
  }

  async updateProfile(userId: string, updateData: Partial<User>): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { password: hashedPassword });
  }

  async setResetPasswordToken(email: string, token: string, expires: Date): Promise<void> {
    await this.userModel.findOneAndUpdate(
      { email },
      { resetPasswordToken: token, resetPasswordExpires: expires }
    );
  }

  async findByResetToken(token: string): Promise<UserDocument | undefined> {
    return (await this.userModel
      .findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() },
      })) as UserDocument | undefined;
  }

  async clearResetToken(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      resetPasswordToken: undefined,
      resetPasswordExpires: undefined,
    });
  }

  async findOrCreateGoogleUser(profile: any): Promise<UserDocument> {
    const googleId = profile.id || profile.sub;
    let user = await this.userModel.findOne({ googleId });

    if (!user) {
      // Check if user exists with same email
      const email = (
        profile.emails?.[0]?.value ||
        profile.email ||
        ''
      ).toLowerCase().trim();

      if (email) {
        user = await this.userModel.findOne({ email });
      }

      if (user) {
        // Link Google account to existing user
        user.googleId = googleId;
        if (user.isActive === false) {
          user.isActive = true;
        }
        if (!user.avatar && (profile.photos?.[0]?.value || profile.picture)) {
          user.avatar = profile.photos?.[0]?.value || profile.picture;
        }
        await user.save();
      } else {
        // Create new user with active status
        const givenName = profile.name?.givenName || profile.given_name || 'Google';
        const familyName = profile.name?.familyName || profile.family_name || 'User';
        const displayName =
          profile.displayName ||
          profile.name ||
          (email ? email.split('@')[0] : `user_${Date.now()}`);

        const newUser = new this.userModel({
          googleId,
          email,
          firstname: givenName,
          lastname: familyName,
          username: displayName,
          roles: [Role.USER],
          isActive: true,
          phone: '',
          address: { street: '', city: '', state: '', zip: '', country: '' },
          avatar: profile.photos?.[0]?.value || profile.picture || '',
        });
        user = await newUser.save();
      }
    } else if (user.isActive === false) {
      user.isActive = true;
      await user.save();
    }

    return user;
  }



  async addAddress(userId: string, addressData: any): Promise<UserDocument | null> {
    const user = await this.findById(userId);
    if (!user) return null;
    if (!user.addresses) user.addresses = [];
    if (!addressData || typeof addressData !== 'object' || Array.isArray(addressData)) {
      throw new BadRequestException('Invalid address');
    }
    // Reject prototype-pollution keys. NOTE: must use Object.keys — every
    // object inherits `.constructor` via its prototype, so a truthiness check
    // like `addressData.constructor` fires for ALL inputs.
    for (const k of Object.keys(addressData)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
        throw new BadRequestException('Invalid address');
      }
    }
    // Validate allowlist
    const allowedKeys = ['street', 'line1', 'line2', 'city', 'state', 'zip', 'pincode', 'country', 'isDefault', 'label', 'phone'];
    const clean: any = {};
    for (const k of allowedKeys) {
      if (addressData[k] !== undefined) {
        if (typeof addressData[k] === 'string') clean[k] = String(addressData[k]).trim().slice(0, 300);
        else if (typeof addressData[k] === 'boolean') clean[k] = addressData[k];
      }
    }
    const streetVal = clean.street || clean.line1;
    const cityVal = clean.city;
    if (!streetVal || !cityVal) throw new BadRequestException('Street and city are required');
    const zipVal = clean.zip || clean.pincode;
    if (zipVal && !/^[0-9A-Za-z\s-]{3,12}$/.test(zipVal)) throw new BadRequestException('Invalid zip');

    // Ensure both alias names are saved so frontend always gets full address
    clean.street = streetVal;
    clean.line1 = streetVal;
    if (zipVal) {
      clean.zip = zipVal;
      clean.pincode = zipVal;
    }

    if (clean.isDefault || user.addresses.length === 0) {
      user.addresses.forEach((a) => (a.isDefault = false));
      clean.isDefault = true;
    }
    user.addresses.push(clean);
    return user.save();
  }

  async removeAddress(userId: string, index: number): Promise<UserDocument | null> {
    const user = await this.findById(userId);
    if (!user || !user.addresses || index < 0 || index >= user.addresses.length) return null;
    const removed = user.addresses.splice(index, 1);
    if (removed[0]?.isDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }
    return user.save();
  }

  async setDefaultAddress(userId: string, index: number): Promise<UserDocument | null> {
    const user = await this.findById(userId);
    if (!user || !user.addresses || index < 0 || index >= user.addresses.length) return null;
    user.addresses.forEach((a, i) => (a.isDefault = i === index));
    return user.save();
  }

  private excludeSensitiveData(query: any) {
    return query.select('-password');
  }
}
