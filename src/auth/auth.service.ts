/* eslint-disable prettier/prettier */
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { jwtConstants } from './constants';
import { RegisterDto } from './dto/register.dto';
import { UserResponse, UserDocument } from '../users/schema/user.schema';
import { Role } from './roles.enum';
import { EmailService } from './email.service';
import * as crypto from 'crypto';
import { ActivityService } from '../managers/activity.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private activityService: ActivityService,
  ) { }

  async validateUser(
    email: string,
    pass: string,
  ): Promise<UserResponse | null> {
    const normalizedEmail = email.toLowerCase().trim();
    const user: UserDocument | undefined =
      await this.usersService.findByEmail(normalizedEmail);
    if (!user) return null;
    if (user.isActive === false) return null;
    if (!user.password) return null;
    const isMatch = await bcrypt.compare(pass, user.password);
    if (isMatch) {
      return {
        _id: user._id.toString(),
        firstname: user.firstname,
        lastname: user.lastname,
        username: user.username,
        email: user.email,
        roles: user.roles,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    }
    return null;
  }

  async login(user: UserResponse): Promise<{
    access_token: string;
    refresh_token: string;
    userId: string;
    email: string;
    roles: Role[];
    createdAt: Date;
    updatedAt: Date;
    username?: string;
  }> {
    const payload = {
      email: user.email,
      sub: user._id,
      roles: user.roles,
      username: user.username,
    };
    await this.activityService.handleLogin(user._id);

    const access_token = await this.jwtService.signAsync(payload, {
      secret: jwtConstants.secret,
      expiresIn: jwtConstants.expiresIn as any,
    });
    const refresh_token = await this.jwtService.signAsync(payload, {
      secret: jwtConstants.refreshSecret,
      expiresIn: jwtConstants.refreshExpiresIn as any,
    });

    await this.usersService.updateRefreshToken(user._id, refresh_token);

    return {
      access_token,
      refresh_token,
      userId: user._id,
      email: user.email,
      roles: user.roles,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      username: user.username,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    userId: string;
    email: string;
    roles: Role[];
    username?: string;
    firstname?: string;
    lastname?: string;
  }> {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: jwtConstants.refreshSecret,
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }
      if (user.isActive === false) {
        throw new UnauthorizedException('Account is deactivated');
      }
      if (user.lastActivityAt) {
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        const inactiveFor = Date.now() - new Date(user.lastActivityAt).getTime();
        if (inactiveFor > sevenDays) {
          throw new UnauthorizedException('Session expired due to inactivity');
        }
      }

      const isRefreshTokenValid = await this.usersService.verifyRefreshToken(
        user._id.toString(),
        refreshToken,
      );
      if (!isRefreshTokenValid) {
        throw new UnauthorizedException('Invalid or revoked refresh token');
      }

      await this.usersService.updateActivity(payload.sub);

      // Always re-read roles from DB — prevents stale privilege after demotion
      const newPayload = {
        email: user.email,
        sub: user._id.toString(),
        roles: user.roles,
        username: user.username,
      };

      const newAccessToken = await this.jwtService.signAsync(newPayload, {
        secret: jwtConstants.secret,
        expiresIn: jwtConstants.expiresIn as any,
      });
      const newRefreshToken = await this.jwtService.signAsync(newPayload, {
        secret: jwtConstants.refreshSecret,
        expiresIn: jwtConstants.refreshExpiresIn as any,
      });

      await this.usersService.updateRefreshToken(user._id.toString(), newRefreshToken);

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        userId: user._id.toString(),
        email: user.email,
        roles: user.roles,
        username: user.username,
        firstname: user.firstname,
        lastname: user.lastname,
      };
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async register(createUserDto: RegisterDto): Promise<UserResponse> {
    const normalizedEmail = createUserDto.email.toLowerCase().trim();
    const exists = await this.usersService.findByEmail(normalizedEmail);
    if (exists) throw new UnauthorizedException('Email already exists');

    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(createUserDto.password, salt);

    const userData = {
      email: normalizedEmail,
      firstname: createUserDto.firstname.trim(),
      lastname: createUserDto.lastname.trim(),
      username: normalizedEmail.split('@')[0],
      password: hash,
      phone: createUserDto.phone?.trim(),
      address: createUserDto.address,
      roles: createUserDto.roles && createUserDto.roles.length > 0 ? createUserDto.roles : [Role.USER],
    };

    // @ts-ignore
    const user: UserDocument = await this.usersService.create(userData);
    return {
      _id: user._id.toString(),
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
      username: user.username,
      roles: user.roles,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.password) {
      throw new BadRequestException('Cannot change password for OAuth users');
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (oldPassword === newPassword) {
      throw new BadRequestException('New password must be different from old password');
    }
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(newPassword, salt);

    await this.usersService.updatePassword(userId, hash);

    return { message: 'Password changed successfully' };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists or not
      return {
        message: 'If the email exists, a password reset link has been sent',
      };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await this.usersService.setResetPasswordToken(email, hashedToken, expires);
    await this.emailService.sendPasswordResetEmail(email, resetToken);

    return {
      message: 'If the email exists, a password reset link has been sent',
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.usersService.findByResetToken(hashedToken);

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(newPassword, salt);

    await this.usersService.updatePassword(user._id.toString(), hash);
    await this.usersService.clearResetToken(user._id.toString());

    return { message: 'Password reset successfully' };
  }

  async googleLogin(user: UserDocument): Promise<{
    access_token: string;
    refresh_token: string;
    userId: string;
    email: string;
    roles: Role[];
    createdAt: Date;
    updatedAt: Date;
    username?: string;
  }> {
    const userResponse: UserResponse = {
      _id: user._id.toString(),
      firstname: user.firstname,
      lastname: user.lastname,
      username: user.username,
      email: user.email,
      roles: user.roles,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return this.login(userResponse);
  }


}
