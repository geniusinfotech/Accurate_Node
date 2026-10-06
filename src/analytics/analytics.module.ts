import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  InventorySalesAnalytics,
  InventorySalesAnalyticsSchema,
} from './schemas/inventory-sales-analytics.schema';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: InventorySalesAnalytics.name,
        schema: InventorySalesAnalyticsSchema,
      },
    ]),
    ProductsModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
