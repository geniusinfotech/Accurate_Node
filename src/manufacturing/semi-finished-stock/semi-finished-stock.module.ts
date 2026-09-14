import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SemiFinishedStockService } from './semi-finished-stock.service';
import { SemiFinishedStockController } from './semi-finished-stock.controller';
import {
  SemiFinishedStock,
  SemiFinishedStockSchema,
} from './schemas/semi-finished-stock.schema';
import {
  WorkBatch,
  WorkBatchSchema,
} from '../work-batches/schemas/work-batch.schema';
import {
  RawMaterial,
  RawMaterialSchema,
} from '../raw-materials/schemas/raw-material.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SemiFinishedStock.name, schema: SemiFinishedStockSchema },
      { name: WorkBatch.name, schema: WorkBatchSchema },
      { name: RawMaterial.name, schema: RawMaterialSchema },
    ]),
  ],
  controllers: [SemiFinishedStockController],
  providers: [SemiFinishedStockService],
  exports: [SemiFinishedStockService],
})
export class SemiFinishedStockModule {}
