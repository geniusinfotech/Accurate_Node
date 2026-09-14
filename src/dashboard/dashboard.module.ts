import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import {
  WorkBatch,
  WorkBatchSchema,
} from '../manufacturing/work-batches/schemas/work-batch.schema';
import {
  RawMaterial,
  RawMaterialSchema,
} from '../manufacturing/raw-materials/schemas/raw-material.schema';
import { WorkerPaymentsModule } from '../manufacturing/worker-payments/worker-payments.module';
import { DealersModule } from '../dealers/dealers.module';
import { SalesModule } from '../sales/sales.module';
import { OrdersModule } from '../orders/orders.module';
import { CustomerLedgerModule } from '../customer-ledger/customer-ledger.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkBatch.name, schema: WorkBatchSchema },
      { name: RawMaterial.name, schema: RawMaterialSchema },
    ]),
    WorkerPaymentsModule,
    DealersModule,
    SalesModule,
    OrdersModule,
    CustomerLedgerModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
