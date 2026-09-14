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
import { CashBankAccountsService } from './cash-bank-accounts.service';
import { CreateCashBankAccountDto } from './dto/create-cash-bank-account.dto';
import { UpdateCashBankAccountDto } from './dto/update-cash-bank-account.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Role } from '../auth/roles.enum';
import { Permission } from '../auth/permissions.enum';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('cash-bank-accounts')
export class CashBankAccountsController {
  constructor(private readonly accountsService: CashBankAccountsService) {}

  @Post()
  @Permissions(Permission.ACCOUNTS_RECORD)
  create(@Body() dto: CreateCashBankAccountDto) {
    return this.accountsService.create(dto);
  }

  @Get()
  @Permissions(Permission.ACCOUNTS_VIEW)
  findAll(@Query('search') search?: string) {
    return this.accountsService.findAll(search);
  }

  @Get(':id')
  @Permissions(Permission.ACCOUNTS_VIEW)
  findOne(@Param('id') id: string) {
    return this.accountsService.findById(id);
  }

  @Get(':id/ledger')
  @Permissions(Permission.ACCOUNTS_VIEW)
  getLedger(@Param('id') id: string) {
    return this.accountsService.getLedger(id);
  }

  @Patch(':id')
  @Permissions(Permission.ACCOUNTS_RECORD)
  update(@Param('id') id: string, @Body() dto: UpdateCashBankAccountDto) {
    return this.accountsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.ACCOUNTS_RECORD)
  remove(@Param('id') id: string) {
    return this.accountsService.remove(id);
  }
}
