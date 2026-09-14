import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { LotsService } from './lots.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('lots')
export class LotsController {
  constructor(private readonly lotsService: LotsService) {}

  @Get(':lotId/trace')
  traceLot(@Param('lotId') lotId: string) {
    return this.lotsService.traceLot(lotId);
  }
}
