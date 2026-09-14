import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('forecast/product/:id')
  async getProductForecast(
    @Param('id') id: string,
    @Query('days') days?: number,
  ) {
    return this.analyticsService.getProductForecast(id, days || 30);
  }

  @Get('forecast/category/:id')
  async getCategoryForecast(@Param('id') id: string) {
    return this.analyticsService.getCategoryForecast(id);
  }

  @Get('risk/stockout')
  async getStockOutRisk() {
    return this.analyticsService.getStockOutRisk();
  }

  @Get('inventory/summary')
  async getSummary() {
    return this.analyticsService.getInventorySummary();
  }

  @Get('inventory/top-selling')
  async getTopSelling(@Query('limit') limit?: number) {
    return this.analyticsService.getTopSelling(limit ? Number(limit) : 10);
  }

  @Get('inventory/slow-moving')
  async getSlowMoving(@Query('days') days?: number) {
    return this.analyticsService.getSlowMoving(days ? Number(days) : 60);
  }
}
