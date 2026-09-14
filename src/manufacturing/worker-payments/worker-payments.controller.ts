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
import { WorkerPaymentsService } from './worker-payments.service';
import { CreateWorkerPaymentDto } from './dto/create-worker-payment.dto';
import { UpdateWorkerPaymentDto } from './dto/update-worker-payment.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Roles } from '../../auth/roles.decorator';
import { Permissions } from '../../auth/permissions.decorator';
import { Role } from '../../auth/roles.enum';
import { Permission } from '../../auth/permissions.enum';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('manufacturing/worker-payments')
export class WorkerPaymentsController {
  constructor(private readonly workerPaymentsService: WorkerPaymentsService) {}

  @Post()
  @Permissions(Permission.ACCOUNTS_RECORD)
  create(@Body() createWorkerPaymentDto: CreateWorkerPaymentDto) {
    return this.workerPaymentsService.create(createWorkerPaymentDto);
  }

  @Get('ledger')
  @Permissions(Permission.ACCOUNTS_VIEW)
  getLedgerSummary() {
    return this.workerPaymentsService.getLedgerSummary();
  }

  @Get()
  @Permissions(Permission.ACCOUNTS_VIEW)
  findAll() {
    return this.workerPaymentsService.findAll();
  }

  @Get('by-batch/:batchId')
  @Permissions(Permission.ACCOUNTS_VIEW)
  findByBatch(@Param('batchId') batchId: string) {
    return this.workerPaymentsService.findByBatch(batchId);
  }

  @Get(':id')
  @Permissions(Permission.ACCOUNTS_VIEW)
  findOne(@Param('id') id: string) {
    return this.workerPaymentsService.findOne(id);
  }

  @Patch(':id')
  @Permissions(Permission.ACCOUNTS_RECORD)
  update(
    @Param('id') id: string,
    @Body() updateWorkerPaymentDto: UpdateWorkerPaymentDto,
  ) {
    return this.workerPaymentsService.update(id, updateWorkerPaymentDto);
  }

  @Delete(':id')
  @Permissions(Permission.ACCOUNTS_RECORD)
  remove(@Param('id') id: string) {
    return this.workerPaymentsService.remove(id);
  }
}
