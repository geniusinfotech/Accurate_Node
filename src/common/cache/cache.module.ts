/* eslint-disable prettier/prettier */
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisCacheService } from './cache.service';
import { CacheController } from './cache.controller';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [CacheController],
  providers: [RedisCacheService],
  exports: [RedisCacheService],
})
export class CacheModule {}