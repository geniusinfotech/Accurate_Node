/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  UseGuards,
  Request,
  Param,
  Delete,
  Body,
  Patch,
  Post,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { LogoutService } from '../auth/logout.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import type { UserDocument, UserResponse } from './schema/user.schema';
import { WishlistService } from '../wishlist/wishlist.service';

@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private logoutService: LogoutService,
    private wishlistService: WishlistService,
  ) { }

  // anyone logged-in
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Request() req: any) {
    const raw = await this.usersService.findById(req.user?.userId as string);
    if (!raw) return null;
    const plain = (raw as any).toObject ? (raw as any).toObject() : raw;
    const { password, resetPasswordToken, resetPasswordExpires, ...safe } = plain;
    return safe;
  }

  // Admin only - list all users
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  async all() {
    return this.usersService.findAll();
  }

  // Admin only - get user's wishlist
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Get(':id/wishlist')
  async getUserWishlist(@Param('id') userId: string) {
    return this.wishlistService.getWishlistByUserId(userId);
  }

  // Admin only - remove user
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  // Admin only - create manager / specialized user
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('manager')
  async createManager(@Body() body: { email: string; password: string; firstname: string; lastname: string; phone?: string }) {
    if (!body?.email || !body?.password || !body?.firstname || !body?.lastname) {
      throw new Error('Missing required fields');
    }
    const dto: any = {
      email: String(body.email).toLowerCase().trim(),
      password: String(body.password),
      firstname: String(body.firstname).trim(),
      lastname: String(body.lastname).trim(),
      phone: body.phone ? String(body.phone).trim() : undefined,
      roles: [Role.MANAGER],
    };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email)) throw new Error('Invalid email');
    if (dto.password.length < 8) throw new Error('Password must be at least 8 characters');
    return this.usersService.createWithHash(dto);
  }

  // Admin only - activate/deactivate user
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.usersService.updateStatus(id, isActive);
  }

  // Admin only - update user roles (give rights)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/roles')
  async updateRoles(@Param('id') id: string, @Body('roles') roles: Role[]) {
    return this.usersService.updateRoles(id, roles);
  }

  // User profile update — explicit allowlist with validation
  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(@Request() req: any, @Body() body: any) {
    const user = await this.usersService.findById(req.user?.userId as string);
    if (!user) {
      return null;
    }

    const updateData: any = {};

    if (typeof body?.name === 'string' && body.name.trim()) {
      const normalizedName = body.name.trim().replace(/\s+/g, ' ').slice(0, 100);
      if (!/^[A-Za-z\s.'-]+$/.test(normalizedName)) {
        throw new Error('Invalid name format');
      }
      const [firstname, ...rest] = normalizedName.split(' ');
      updateData.firstname = firstname.slice(0, 50);
      updateData.lastname = (rest.join(' ') || user.lastname || firstname).slice(0, 50);
      updateData.username = normalizedName;
    }

    if (typeof body?.phone === 'string' && body.phone.trim()) {
      const clean = body.phone.trim().replace(/\s+/g, '');
      if (!/^\+?[0-9]{10,15}$/.test(clean)) throw new Error('Invalid phone');
      updateData.phone = clean;
    }

    if (body?.address !== undefined) {
      const existingAddress = (user as any).address || {};
      const sanitize = (v: any, fallback: string, max = 200) => {
        if (typeof v !== 'string') return fallback;
        return v.trim().slice(0, max);
      };
      if (typeof body.address === 'string') {
        updateData.address = {
          street: sanitize(body.address, '', 300),
          city: sanitize(existingAddress.city, ''),
          state: sanitize(existingAddress.state, ''),
          zip: sanitize(existingAddress.zip, ''),
          country: sanitize(existingAddress.country, ''),
        };
      } else if (typeof body.address === 'object' && body.address !== null) {
        // Reject prototype pollution keys
        const allowed = ['street', 'city', 'state', 'zip', 'country'];
        for (const k of Object.keys(body.address)) {
          if (!allowed.includes(k)) throw new Error(`Invalid address field: ${k}`);
          if (k === '__proto__' || k === 'constructor' || k === 'prototype') throw new Error('Invalid address');
        }
        updateData.address = {
          street: sanitize(body.address.street, existingAddress.street ?? ''),
          city: sanitize(body.address.city, existingAddress.city ?? ''),
          state: sanitize(body.address.state, existingAddress.state ?? ''),
          zip: sanitize(body.address.zip, existingAddress.zip ?? ''),
          country: sanitize(body.address.country, existingAddress.country ?? ''),
        };
        if (updateData.address.zip && !/^[0-9A-Za-z\s-]{3,12}$/.test(updateData.address.zip)) {
          throw new Error('Invalid zip');
        }
      }
    }

    if (typeof body?.avatar === 'string' && body.avatar.trim()) {
      const avatar = body.avatar.trim();
      if (avatar.length > 2048) throw new Error('Avatar URL too long');
      // Only allow http(s) or relative path, block javascript: and data:html
      if (/^\s*javascript:/i.test(avatar) || /^\s*data:text\/html/i.test(avatar)) throw new Error('Invalid avatar URL');
      try {
        if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
          new URL(avatar);
        } else if (!avatar.startsWith('/') && !avatar.startsWith('data:image/')) {
          throw new Error('Invalid avatar');
        }
      } catch {
        throw new Error('Invalid avatar URL');
      }
      updateData.avatar = avatar;
    }

    const updated = await this.usersService.updateProfile(
      req.user?.userId as string,
      updateData,
    );

    if (!updated) {
      return null;
    }

    const plain = (updated as any).toObject ? (updated as any).toObject() : updated;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safeUser } = plain;
    return safeUser;
  }

  // User logout
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async userLogout(@Request() req: any) {
    const user: UserDocument | undefined = await this.usersService.findById(req.user?.userId as string);
    if (!user) {
      return { message: 'User not found' };
    }
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
    return await this.logoutService.logout(userResponse);
  }

  // Manager logout
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER)
  @Post('manager/logout')
  async managerLogout(@Request() req: any) {
    const user: UserDocument | undefined = await this.usersService.findById(req.user?.userId as string);
    if (!user) {
      return { message: 'User not found' };
    }
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
    return await this.logoutService.logoutWithRole(userResponse, 'Manager');
  }

  // Address Endpoints
  @UseGuards(JwtAuthGuard)
  @Post('addresses')
  async addAddress(@Request() req: any, @Body() body: any) {
    const userId = req.user?.userId || req.user?.id;
    return this.usersService.addAddress(userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('addresses/:index')
  async removeAddress(@Request() req: any, @Param('index') index: string) {
    const userId = req.user?.userId || req.user?.id;
    return this.usersService.removeAddress(userId, parseInt(index, 10));
  }

  @UseGuards(JwtAuthGuard)
  @Patch('addresses/:index/default')
  async setDefaultAddress(@Request() req: any, @Param('index') index: string) {
    const userId = req.user?.userId || req.user?.id;
    return this.usersService.setDefaultAddress(userId, parseInt(index, 10));
  }
}
