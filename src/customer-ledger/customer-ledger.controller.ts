import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { CustomerLedgerService } from './customer-ledger.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Role } from '../auth/roles.enum';
import { Permission } from '../auth/permissions.enum';
import { RecordCustomerPaymentDto } from './dto/record-customer-payment.dto';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('customer-ledger')
export class CustomerLedgerController {
  constructor(private readonly ledgerService: CustomerLedgerService) {}

  @Post('payment')
  @Permissions(Permission.ACCOUNTS_RECORD)
  recordPayment(@Body() dto: RecordCustomerPaymentDto) {
    return this.ledgerService.recordPayment(dto);
  }

  @Get('summary')
  @Permissions(Permission.ACCOUNTS_VIEW)
  getSummary() {
    return this.ledgerService.getSummary();
  }

  @Get('ledger')
  @Permissions(Permission.ACCOUNTS_VIEW)
  getLedger(
    @Query('customerName') customerName: string,
    @Query('phone') phone?: string,
  ) {
    return this.ledgerService.getLedger(customerName, phone);
  }

  @Get()
  @Permissions(Permission.ACCOUNTS_VIEW)
  findAll(
    @Query('customerName') customerName?: string,
    @Query('phone') phone?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ledgerService.findAll({ customerName, phone, from, to });
  }
}
