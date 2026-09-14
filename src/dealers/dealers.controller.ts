import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { DealersService } from './dealers.service';
import { CreateDealerDto } from './dto/create-dealer.dto';
import { UpdateDealerDto } from './dto/update-dealer.dto';
import { CreateDealerLedgerDto } from './dto/create-dealer-ledger.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Role } from '../auth/roles.enum';
import { Permission } from '../auth/permissions.enum';
import { SalesService } from '../sales/sales.service';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('dealers')
export class DealersController {
  constructor(
    private readonly dealersService: DealersService,
    @Inject(forwardRef(() => SalesService))
    private readonly salesService: SalesService,
  ) {}

  @Post()
  @Permissions(Permission.DEALERS_ADD)
  create(@Body() createDealerDto: CreateDealerDto) {
    return this.dealersService.createDealer(createDealerDto);
  }

  @Get()
  @Permissions(Permission.DEALERS_VIEW)
  findAll() {
    return this.dealersService.findAllDealers();
  }

  @Get('search')
  @Permissions(Permission.DEALERS_VIEW)
  search(@Query('query') query: string) {
    return this.dealersService.searchDealers(query);
  }

  @Get('ledger/summary')
  @Permissions(Permission.DEALERS_VIEW)
  getLedgerSummary() {
    return this.dealersService.getLedgerSummary();
  }

  @Get(':id')
  @Permissions(Permission.DEALERS_VIEW)
  findOne(@Param('id') id: string) {
    return this.dealersService.findDealerById(id);
  }

  @Patch(':id')
  @Permissions(Permission.DEALERS_EDIT)
  update(@Param('id') id: string, @Body() updateDealerDto: UpdateDealerDto) {
    return this.dealersService.updateDealer(id, updateDealerDto);
  }

  @Delete(':id')
  @Permissions(Permission.DEALERS_DELETE)
  remove(@Param('id') id: string) {
    return this.dealersService.removeDealer(id);
  }

  @Post(':id/ledger')
  @Permissions(Permission.DEALERS_LEDGER)
  addLedgerEntry(
    @Param('id') id: string,
    @Body() createLedgerDto: CreateDealerLedgerDto,
  ) {
    createLedgerDto.dealerId = id;
    return this.dealersService.addLedgerEntry(createLedgerDto);
  }

  @Get(':id/ledger')
  @Permissions(Permission.DEALERS_VIEW)
  getLedger(@Param('id') id: string) {
    return this.dealersService.getLedger(id);
  }

  @Get(':id/bills')
  @Permissions(Permission.SELL_VIEW)
  getBills(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
  ) {
    return this.salesService.findByDealer(id, {
      page,
      limit,
      from,
      to,
      search,
      sort,
    });
  }
}
