import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';

@Controller('managers/activity')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('report')
  async getAllReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('managerId') managerId?: string,
  ) {
    return this.activityService.getAllManagersReport(
      new Date(startDate || new Date(0)),
      new Date(endDate || new Date()),
      managerId,
    );
  }

  @Get('report/:managerId')
  async getOneReport(
    @Param('managerId') managerId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.activityService.getManagerReport(
      managerId,
      new Date(startDate || new Date(0)),
      new Date(endDate || new Date()),
    );
  }
}
