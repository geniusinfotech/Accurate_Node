import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LotsService } from './lots.service';
import { LotsController } from './lots.controller';
import {
  RawMaterial,
  RawMaterialSchema,
} from '../manufacturing/raw-materials/schemas/raw-material.schema';
import {
  WorkBatch,
  WorkBatchSchema,
} from '../manufacturing/work-batches/schemas/work-batch.schema';
import {
  SemiFinishedStock,
  SemiFinishedStockSchema,
} from '../manufacturing/semi-finished-stock/schemas/semi-finished-stock.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RawMaterial.name, schema: RawMaterialSchema },
      { name: WorkBatch.name, schema: WorkBatchSchema },
      { name: SemiFinishedStock.name, schema: SemiFinishedStockSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [LotsController],
  providers: [LotsService],
  exports: [LotsService],
})
export class LotsModule {}
