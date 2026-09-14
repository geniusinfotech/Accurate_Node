import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CustomerLedger,
  CustomerLedgerSchema,
} from './schemas/customer-ledger.schema';
import { CustomerLedgerService } from './customer-ledger.service';
import { CustomerLedgerController } from './customer-ledger.controller';
import { CustomersModule } from '../customers/customers.module';
import { CashBankEntriesModule } from '../cash-bank-entries/cash-bank-entries.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CustomerLedger.name, schema: CustomerLedgerSchema },
    ]),
    CustomersModule,
    CashBankEntriesModule,
  ],
  controllers: [CustomerLedgerController],
  providers: [CustomerLedgerService],
  exports: [CustomerLedgerService, MongooseModule],
})
export class CustomerLedgerModule {}
