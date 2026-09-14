import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Role } from '../auth/roles.enum';
import { Permission } from '../auth/permissions.enum';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  @Permissions(Permission.REPORTS_VIEW)
  salesReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('customer') customer?: string,
    @Query('shop') shop?: string,
    @Query('productId') productId?: string,
    @Query('managerId') managerId?: string,
    @Query('groupBy') groupBy?: string,
  ) {
    return this.reportsService.salesReport({
      from,
      to,
      customer,
      shop,
      productId,
      managerId,
      groupBy,
    });
  }

  @Get('purchases')
  @Permissions(Permission.REPORTS_VIEW)
  purchasesReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('dealer') dealer?: string,
    @Query('material') material?: string,
  ) {
    return this.reportsService.purchasesReport({ from, to, dealer, material });
  }

  @Get('inventory')
  @Permissions(Permission.REPORTS_VIEW)
  inventoryReport(
    @Query('productId') productId?: string,
    @Query('material') material?: string,
    @Query('category') category?: string,
  ) {
    return this.reportsService.inventoryReport({
      productId,
      material,
      category,
    });
  }

  @Get('dealers')
  @Permissions(Permission.REPORTS_VIEW)
  dealersReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('dealer') dealer?: string,
  ) {
    return this.reportsService.dealersReport({ from, to, dealer });
  }

  @Get('customers')
  @Permissions(Permission.REPORTS_VIEW)
  customersReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('customer') customer?: string,
  ) {
    return this.reportsService.customersReport({ from, to, customer });
  }

  @Get('workers')
  @Permissions(Permission.REPORTS_VIEW)
  workersReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('worker') worker?: string,
  ) {
    return this.reportsService.workersReport({ from, to, worker });
  }

  @Get('managers')
  @Permissions(Permission.REPORTS_VIEW)
  managersReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('manager') manager?: string,
  ) {
    return this.reportsService.managersReport({ from, to, manager });
  }
}
