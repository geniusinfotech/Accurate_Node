import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { WorkBatchesService } from './work-batches.service';
import { WorkBatchesController } from './work-batches.controller';
import { WorkBatch, WorkBatchSchema } from './schemas/work-batch.schema';
import {
  RawMaterial,
  RawMaterialSchema,
} from '../raw-materials/schemas/raw-material.schema';
import { Worker, WorkerSchema } from '../workers/schemas/worker.schema';
import { ManagersModule } from '../../managers/managers.module';
import { RawMaterialsModule } from '../raw-materials/raw-materials.module';
import { SemiFinishedStockModule } from '../semi-finished-stock/semi-finished-stock.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: WorkBatch.name, schema: WorkBatchSchema },
      { name: RawMaterial.name, schema: RawMaterialSchema },
      { name: Worker.name, schema: WorkerSchema },
    ]),
    ManagersModule,
    RawMaterialsModule,
    SemiFinishedStockModule,
  ],
  controllers: [WorkBatchesController],
  providers: [WorkBatchesService],
  exports: [WorkBatchesService],
})
export class WorkBatchesModule {}
