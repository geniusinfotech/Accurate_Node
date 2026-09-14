import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  RawMaterial,
  RawMaterialDocument,
} from '../manufacturing/raw-materials/schemas/raw-material.schema';
import {
  WorkBatch,
  WorkBatchDocument,
} from '../manufacturing/work-batches/schemas/work-batch.schema';
import {
  SemiFinishedStock,
  SemiFinishedStockDocument,
} from '../manufacturing/semi-finished-stock/schemas/semi-finished-stock.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';

@Injectable()
export class LotsService {
  constructor(
    @InjectModel(RawMaterial.name)
    private rawMaterialModel: Model<RawMaterialDocument>,
    @InjectModel(WorkBatch.name)
    private workBatchModel: Model<WorkBatchDocument>,
    @InjectModel(SemiFinishedStock.name)
    private stockModel: Model<SemiFinishedStockDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  async traceLot(lotId: string): Promise<any> {
    const rawMaterials = await this.rawMaterialModel
      .find({ lotId })
      .populate('dealerId')
      .exec();

    const workBatches = await this.workBatchModel
      .find({ lotId })
      .populate('workerId')
      .populate('rawMaterialId')
      .populate('parentBatchId')
      .exec();

    const semiFinishedStocks = await this.stockModel
      .find({ lotId })
      .populate('rawMaterialId')
      .populate('batchId')
      .exec();

    const stockIds = semiFinishedStocks.map((s) => s._id);

    const products = await this.productModel
      .find({
        $or: [{ lotId }, { sourceStockId: { $in: stockIds } }],
      })
      .populate('categoryId')
      .populate('brandId')
      .exec();

    if (
      rawMaterials.length === 0 &&
      workBatches.length === 0 &&
      semiFinishedStocks.length === 0 &&
      products.length === 0
    ) {
      throw new NotFoundException(`No records found for Lot ID ${lotId}`);
    }

    return {
      lotId,
      rawMaterials,
      workBatches,
      semiFinishedStocks,
      products,
    };
  }
}
