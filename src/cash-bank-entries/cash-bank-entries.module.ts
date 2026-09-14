import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CashBankEntry,
  CashBankEntrySchema,
} from './schemas/cash-bank-entry.schema';
import { CashBankEntriesService } from './cash-bank-entries.service';
import { CashBankEntriesController } from './cash-bank-entries.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CashBankEntry.name, schema: CashBankEntrySchema },
    ]),
  ],
  controllers: [CashBankEntriesController],
  providers: [CashBankEntriesService],
  exports: [CashBankEntriesService],
})
export class CashBankEntriesModule {}
