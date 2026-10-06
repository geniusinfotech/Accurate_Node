import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Patch,
  Delete,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ManagersService } from './managers.service';
import { CreateManagerDto } from './dto/create-manager.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { Permission } from '../auth/permissions.enum';

@Controller('managers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ManagersController {
  constructor(private readonly managersService: ManagersService) {}

  @Post()
  async create(@Body() createManagerDto: CreateManagerDto) {
    return this.managersService.create(createManagerDto);
  }

  @Get()
  async findAll() {
    return this.managersService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.managersService.findOne(id);
  }

  @Patch(':userId/permissions')
  async updatePermissions(
    @Param('userId') userId: string,
    @Body('permissions') permissions: Permission[],
  ) {
    if (!/^[a-fA-F0-9]{24}$/.test(userId)) throw new Error('Invalid userId');
    const allowed = Object.values(Permission) as string[];
    if (!Array.isArray(permissions) || permissions.length > 50)
      throw new Error('Invalid permissions');
    for (const p of permissions)
      if (!allowed.includes(p as string))
        throw new Error(`Invalid permission: ${p}`);
    return this.managersService.updatePermissions(userId, permissions);
  }

  @Patch(':userId/widgets')
  async updateWidgets(
    @Param('userId') userId: string,
    @Body('widgets') widgets: string[],
  ) {
    if (!/^[a-fA-F0-9]{24}$/.test(userId)) throw new Error('Invalid userId');
    if (!Array.isArray(widgets) || widgets.length > 20)
      throw new Error('Invalid widgets');
    for (const w of widgets) {
      if (typeof w !== 'string' || w.length > 100 || /[<>]/.test(w))
        throw new Error('Invalid widget');
    }
    return this.managersService.updateWidgets(userId, widgets);
  }

  @Patch(':userId/status')
  async updateStatus(
    @Param('userId') userId: string,
    @Body('status') status: 'active' | 'inactive',
  ) {
    return this.managersService.createOrUpdateManager(userId, { status });
  }

  @Patch(':userId/password')
  async resetPassword(
    @Param('userId') userId: string,
    @Body('password') password: string,
  ) {
    if (!/^[a-fA-F0-9]{24}$/.test(userId)) throw new Error('Invalid userId');
    if (typeof password !== 'string' || password.length < 8)
      throw new Error('Password must be at least 8 characters');
    return this.managersService.resetPassword(userId, password);
  }

  @Delete(':userId')
  async remove(@Param('userId') userId: string) {
    if (!/^[a-fA-F0-9]{24}$/.test(userId)) throw new Error('Invalid userId');
    return this.managersService.removeByUserId(userId);
  }

  @Get('me/config')
  @Roles(Role.MANAGER, Role.ADMIN)
  async getMyConfig(@Req() req: any) {
    return this.managersService.findByUserId(req.user._id);
  }
}
