import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Patch,
  Req,
} from '@nestjs/common';
import { AdminsService } from './admins.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN) // Only existing admins can create/manage other admins
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Post()
  async create(@Body() createAdminDto: CreateAdminDto) {
    return this.adminsService.create(createAdminDto);
  }

  @Get()
  async findAll() {
    return this.adminsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.adminsService.findOne(id);
  }

  @Get('me/config')
  async getMyConfig(@Req() req: any) {
    return this.adminsService.findByUserId(req.user._id);
  }

  @Patch(':userId/settings')
  async updateSettings(
    @Param('userId') userId: string,
    @Body('settings') settings: Record<string, any>,
  ) {
    return this.adminsService.updateSettings(userId, settings);
  }

  @Patch(':userId/status')
  async updateStatus(
    @Param('userId') userId: string,
    @Body('status') status: 'active' | 'inactive',
  ) {
    return this.adminsService.updateStatus(userId, status);
  }
}
