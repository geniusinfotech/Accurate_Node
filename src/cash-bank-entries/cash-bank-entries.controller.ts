import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CashBankEntriesService } from './cash-bank-entries.service';
import { CreateCashBankEntryDto } from './dto/create-cash-bank-entry.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Role } from '../auth/roles.enum';
import { Permission } from '../auth/permissions.enum';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('cash-bank-entries')
export class CashBankEntriesController {
  constructor(private readonly entriesService: CashBankEntriesService) {}

  @Post()
  @Permissions(Permission.ACCOUNTS_RECORD)
  create(@Body() dto: CreateCashBankEntryDto) {
    return this.entriesService.create(dto);
  }

  @Get()
  @Permissions(Permission.ACCOUNTS_VIEW)
  findAll(
    @Query('accountId') accountId?: string,
    @Query('voucherType') voucherType?: 'receipt' | 'payment',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.entriesService.findAll({ accountId, voucherType, from, to });
  }

  @Patch(':id/cancel')
  @Permissions(Permission.ACCOUNTS_RECORD)
  cancel(@Param('id') id: string) {
    return this.entriesService.cancel(id);
  }

  @Delete(':id')
  @Permissions(Permission.ACCOUNTS_RECORD)
  remove(@Param('id') id: string) {
    return this.entriesService.remove(id);
  }
}
