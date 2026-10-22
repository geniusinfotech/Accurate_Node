import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Role } from '../auth/roles.enum';
import { Permission } from '../auth/permissions.enum';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.COUPONS_ADD)
  async create(@Body() createDto: CreateCouponDto) {
    return this.couponsService.create(createDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.COUPONS_VIEW)
  async findAll() {
    return this.couponsService.findAll();
  }

  @Get('my-loyalty')
  @UseGuards(JwtAuthGuard)
  async getMyLoyalty(@Request() req) {
    return this.couponsService.getUserLoyaltyStatus(req.user.userId);
  }

  @Post('validate')
  @UseGuards(OptionalJwtAuthGuard)
  async validateCoupon(@Body('code') code: any, @Request() req) {
    if (!code || typeof code !== 'string' || !code.trim()) {
      throw new BadRequestException('A valid coupon code string is required');
    }
    const userId = req.user?.userId || req.user?.sub || req.user?.id || req.user?._id;
    return this.couponsService.validateCoupon(code.trim().toUpperCase(), userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.COUPONS_VIEW)
  async findOne(@Param('id') id: string) {
    return this.couponsService.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.COUPONS_EDIT)
  async update(@Param('id') id: string, @Body() updateDto: UpdateCouponDto) {
    return this.couponsService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.COUPONS_DELETE)
  async remove(@Param('id') id: string) {
    return this.couponsService.remove(id);
  }
}
