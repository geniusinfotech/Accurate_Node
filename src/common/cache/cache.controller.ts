/* eslint-disable prettier/prettier */
import { Controller, Get } from '@nestjs/common';
import { RedisCacheService } from './cache.service';

@Controller('cache')
export class CacheController {
  constructor(private readonly cache: RedisCacheService) {}

  @Get('status')
  status() {
    return { redis: this.cache.isEnabled() ? 'connected' : 'disabled' };
  }
}