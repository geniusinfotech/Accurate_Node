import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Delete,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto, UpdateSaleDto } from './dto/create-sale.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Role } from '../auth/roles.enum';
import { Permission } from '../auth/permissions.enum';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @Permissions(Permission.SELL_CREATE)
  create(@Body() createSaleDto: CreateSaleDto, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub || req.user?._id;
    return this.salesService.create(createSaleDto, userId);
  }

  @Get()
  @Permissions(Permission.SELL_VIEW)
  findAll() {
    return this.salesService.findAll();
  }

  @Get('next-number')
  @Permissions(Permission.SELL_VIEW)
  getNextSaleNumber() {
    return this.salesService.getNextSaleNumber();
  }

  @Get('summary')
  @Permissions(Permission.SELL_VIEW)
  getSummary() {
    return this.salesService.getSummary();
  }

  @Get('by-customer/:customerId')
  @Permissions(Permission.SELL_VIEW)
  findByCustomer(
    @Param('customerId') customerId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
  ) {
    return this.salesService.findByCustomer(customerId, {
      page,
      limit,
      from,
      to,
      search,
      sort,
    });
  }

  @Get('by-dealer/:dealerId')
  @Permissions(Permission.SELL_VIEW)
  findByDealer(
    @Param('dealerId') dealerId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
  ) {
    return this.salesService.findByDealer(dealerId, {
      page,
      limit,
      from,
      to,
      search,
      sort,
    });
  }

  @Get(':id')
  @Permissions(Permission.SELL_VIEW)
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }

  @Put(':id')
  @Permissions(Permission.SELL_EDIT)
  update(
    @Param('id') id: string,
    @Body() updateSaleDto: UpdateSaleDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId || req.user?.sub || req.user?._id;
    return this.salesService.update(id, updateSaleDto, userId);
  }

  @Delete(':id')
  @Permissions(Permission.SELL_DELETE)
  remove(@Param('id') id: string) {
    return this.salesService.remove(id);
  }
}
