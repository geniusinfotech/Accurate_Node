import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { Sale, SaleSchema } from './schemas/sale.schema';
import { InventoryModule } from '../inventory/inventory.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CustomerLedgerModule } from '../customer-ledger/customer-ledger.module';
import { ShopProductsModule } from '../shop-products/shop-products.module';
import { CustomersModule } from '../customers/customers.module';
import { DealersModule } from '../dealers/dealers.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Sale.name, schema: SaleSchema }]),
    InventoryModule,
    ShopProductsModule,
    AnalyticsModule,
    CustomerLedgerModule,
    CustomersModule,
    forwardRef(() => DealersModule),
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService, MongooseModule],
})
export class SalesModule {}
