import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { SemiFinishedStockService } from './semi-finished-stock.service';
import { CreateSemiFinishedStockDto } from './dto/create-semi-finished-stock.dto';
import { UpdateSemiFinishedStockDto } from './dto/update-semi-finished-stock.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/roles.enum';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions.enum';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('manufacturing/semi-finished-stock')
export class SemiFinishedStockController {
  constructor(
    private readonly semiFinishedStockService: SemiFinishedStockService,
  ) {}

  @Post()
  @Permissions(Permission.INVENTORY_ADD)
  create(@Body() createSemiFinishedStockDto: CreateSemiFinishedStockDto) {
    return this.semiFinishedStockService.create(createSemiFinishedStockDto);
  }

  @Get()
  @Permissions(Permission.INVENTORY_VIEW)
  findAll() {
    return this.semiFinishedStockService.findAll();
  }

  @Get(':id')
  @Permissions(Permission.INVENTORY_VIEW)
  findOne(@Param('id') id: string) {
    return this.semiFinishedStockService.findOne(id);
  }

  @Patch(':id')
  @Permissions(Permission.INVENTORY_EDIT)
  update(
    @Param('id') id: string,
    @Body() updateSemiFinishedStockDto: UpdateSemiFinishedStockDto,
  ) {
    return this.semiFinishedStockService.update(id, updateSemiFinishedStockDto);
  }

  @Delete(':id')
  @Permissions(Permission.INVENTORY_DELETE)
  remove(@Param('id') id: string) {
    return this.semiFinishedStockService.remove(id);
  }
}
