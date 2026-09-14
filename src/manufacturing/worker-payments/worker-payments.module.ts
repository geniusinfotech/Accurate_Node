import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkerPaymentsService } from './worker-payments.service';
import { WorkerPaymentsController } from './worker-payments.controller';
import {
  WorkerPayment,
  WorkerPaymentSchema,
} from './schemas/worker-payment.schema';
import {
  WorkBatch,
  WorkBatchSchema,
} from '../work-batches/schemas/work-batch.schema';
import { Worker, WorkerSchema } from '../workers/schemas/worker.schema';
import { ManagersModule } from '../../managers/managers.module';
import { CashBankEntriesModule } from '../../cash-bank-entries/cash-bank-entries.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkerPayment.name, schema: WorkerPaymentSchema },
      { name: WorkBatch.name, schema: WorkBatchSchema },
      { name: Worker.name, schema: WorkerSchema },
    ]),
    ManagersModule,
    CashBankEntriesModule,
  ],
  controllers: [WorkerPaymentsController],
  providers: [WorkerPaymentsService],
  exports: [WorkerPaymentsService],
})
export class WorkerPaymentsModule {}
