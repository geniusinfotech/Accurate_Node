import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Dealer, DealerSchema } from './schemas/dealer.schema';
import {
  DealerLedger,
  DealerLedgerSchema,
} from './schemas/dealer-ledger.schema';
import {
  RawMaterial,
  RawMaterialSchema,
} from '../manufacturing/raw-materials/schemas/raw-material.schema';
import { DealersService } from './dealers.service';
import { DealersController } from './dealers.controller';
import { ManagersModule } from '../managers/managers.module';
import { SalesModule } from '../sales/sales.module';
import { CashBankEntriesModule } from '../cash-bank-entries/cash-bank-entries.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Dealer.name, schema: DealerSchema },
      { name: DealerLedger.name, schema: DealerLedgerSchema },
      { name: RawMaterial.name, schema: RawMaterialSchema },
    ]),
    ManagersModule,
    forwardRef(() => SalesModule),
    CashBankEntriesModule,
  ],
  controllers: [DealersController],
  providers: [DealersService],
  exports: [DealersService, MongooseModule],
})
export class DealersModule {}
