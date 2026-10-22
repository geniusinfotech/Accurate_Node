/* eslint-disable prettier/prettier */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { RedisCacheService } from './cache.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/roles.enum';

@Controller('cache')
export class CacheController {
  constructor(private readonly cache: RedisCacheService) {}

  // Internal detail: admins only.
  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  status() {
    return { redis: this.cache.isEnabled() ? 'connected' : 'disabled' };
  }
}
