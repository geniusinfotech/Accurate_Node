import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateTrackingDto } from './dto/update-tracking.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Role } from '../auth/roles.enum';
import { Permission } from '../auth/permissions.enum';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  create(@Body() createOrderDto: CreateOrderDto, @Req() req: any) {
    const userId =
      req.user?.userId || req.user?.sub || req.user?.id || req.user?._id;
    return this.ordersService.create(createOrderDto, userId);
  }

  @Get('my-orders')
  @UseGuards(OptionalJwtAuthGuard)
  getMyOrders(@Req() req: any, @Query('phone') phone?: string) {
    const userId =
      req.user?.userId || req.user?.sub || req.user?.id || req.user?._id;
    return this.ordersService.findByUser(userId, phone);
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.ORDERS_VIEW)
  getSummary() {
    return this.ordersService.getSummary();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.ORDERS_VIEW)
  findAll(
    @Query('status') status?: string,
    @Query('date') date?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ordersService.findAll(status, { date, from, to });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.ordersService.findOne(id, req.user);
  }

  @Patch(':id/tracking')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.ORDERS_UPDATE)
  updateTracking(
    @Param('id') id: string,
    @Body() updateTrackingDto: UpdateTrackingDto,
  ) {
    return this.ordersService.updateTracking(id, updateTrackingDto);
  }

  @Patch(':id/shipping-address')
  @UseGuards(JwtAuthGuard)
  updateShippingAddress(
    @Param('id') id: string,
    @Body()
    body: {
      customerName?: string;
      phone?: string;
      address?: string;
      pincode?: string;
    },
    @Req() req: any,
  ) {
    return this.ordersService.updateShippingAddress(id, body, req.user);
  }
}
