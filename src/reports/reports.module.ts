import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Sale, SaleSchema } from '../sales/schemas/sale.schema';
import {
  RawMaterial,
  RawMaterialSchema,
} from '../manufacturing/raw-materials/schemas/raw-material.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import {
  SemiFinishedStock,
  SemiFinishedStockSchema,
} from '../manufacturing/semi-finished-stock/schemas/semi-finished-stock.schema';
import {
  WorkBatch,
  WorkBatchSchema,
} from '../manufacturing/work-batches/schemas/work-batch.schema';
import {
  WorkerPayment,
  WorkerPaymentSchema,
} from '../manufacturing/worker-payments/schemas/worker-payment.schema';
import {
  Worker,
  WorkerSchema,
} from '../manufacturing/workers/schemas/worker.schema';
import { Dealer, DealerSchema } from '../dealers/schemas/dealer.schema';
import {
  DealerLedger,
  DealerLedgerSchema,
} from '../dealers/schemas/dealer-ledger.schema';
import {
  CustomerLedger,
  CustomerLedgerSchema,
} from '../customer-ledger/schemas/customer-ledger.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Sale.name, schema: SaleSchema },
      { name: RawMaterial.name, schema: RawMaterialSchema },
      { name: Product.name, schema: ProductSchema },
      { name: SemiFinishedStock.name, schema: SemiFinishedStockSchema },
      { name: WorkBatch.name, schema: WorkBatchSchema },
      { name: WorkerPayment.name, schema: WorkerPaymentSchema },
      { name: Worker.name, schema: WorkerSchema },
      { name: Dealer.name, schema: DealerSchema },
      { name: DealerLedger.name, schema: DealerLedgerSchema },
      { name: CustomerLedger.name, schema: CustomerLedgerSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
