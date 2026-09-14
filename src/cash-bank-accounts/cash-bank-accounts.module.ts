import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CashBankAccount,
  CashBankAccountSchema,
} from './schemas/cash-bank-account.schema';
import { CashBankAccountsService } from './cash-bank-accounts.service';
import { CashBankAccountsController } from './cash-bank-accounts.controller';
import { CashBankEntriesModule } from '../cash-bank-entries/cash-bank-entries.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CashBankAccount.name, schema: CashBankAccountSchema },
    ]),
    CashBankEntriesModule,
  ],
  controllers: [CashBankAccountsController],
  providers: [CashBankAccountsService],
  exports: [CashBankAccountsService],
})
export class CashBankAccountsModule {}
