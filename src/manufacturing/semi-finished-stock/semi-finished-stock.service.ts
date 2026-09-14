import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateSemiFinishedStockDto } from './dto/create-semi-finished-stock.dto';
import { UpdateSemiFinishedStockDto } from './dto/update-semi-finished-stock.dto';
import {
  SemiFinishedStock,
  SemiFinishedStockDocument,
} from './schemas/semi-finished-stock.schema';
import {
  WorkBatch,
  WorkBatchDocument,
} from '../work-batches/schemas/work-batch.schema';
import {
  RawMaterial,
  RawMaterialDocument,
} from '../raw-materials/schemas/raw-material.schema';

@Injectable()
export class SemiFinishedStockService {
  constructor(
    @InjectModel(SemiFinishedStock.name)
    private stockModel: Model<SemiFinishedStockDocument>,
    @InjectModel(WorkBatch.name) private batchModel: Model<WorkBatchDocument>,
    @InjectModel(RawMaterial.name)
    private rawMaterialModel: Model<RawMaterialDocument>,
  ) {}

  async create(
    createDto: CreateSemiFinishedStockDto,
  ): Promise<SemiFinishedStockDocument> {
    const data: any = { ...createDto };
    if (!data.lotId) {
      if (data.batchId) {
        const b = await this.batchModel.findById(data.batchId).exec();
        if (b?.lotId) {
          data.lotId = b.lotId;
        }
      } else if (data.rawMaterialId) {
        const rm = await this.rawMaterialModel
          .findById(data.rawMaterialId)
          .exec();
        if (rm?.lotId) {
          data.lotId = rm.lotId;
        }
      }
    }
    const created = new this.stockModel(data);
    return created.save();
  }

  async findAll(): Promise<SemiFinishedStockDocument[]> {
    return this.stockModel
      .find()
      .populate('rawMaterialId')
      .populate('batchId')
      .exec();
  }

  async findOne(id: string): Promise<SemiFinishedStockDocument> {
    const stock = await this.stockModel
      .findById(id)
      .populate('rawMaterialId')
      .populate('batchId')
      .exec();
    if (!stock) {
      throw new NotFoundException(`Stock with ID ${id} not found`);
    }
    return stock;
  }

  async update(
    id: string,
    updateDto: UpdateSemiFinishedStockDto,
  ): Promise<SemiFinishedStockDocument> {
    const updated = await this.stockModel
      .findByIdAndUpdate(id, updateDto, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(`Stock with ID ${id} not found`);
    }
    return updated;
  }

  async decrementQuantityAtomic(
    id: string,
    amount: number,
  ): Promise<SemiFinishedStockDocument> {
    const updated = await this.stockModel.findOneAndUpdate(
      { _id: id, quantity: { $gte: amount } }, // guard: only if enough stock
      { $inc: { quantity: -amount } },
      { new: true },
    );
    if (!updated) {
      // either not found, or not enough stock at the moment of update
      throw new BadRequestException(
        'Insufficient stock — it may have just been assigned to another worker',
      );
    }
    return updated;
  }

  async incrementQuantity(
    id: string,
    amount: number,
  ): Promise<SemiFinishedStockDocument | null> {
    return this.stockModel.findByIdAndUpdate(
      id,
      { $inc: { quantity: amount } },
      { new: true },
    );
  }

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const result = await this.stockModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Stock with ID ${id} not found`);
    }
    return { success: true, message: 'Stock deleted successfully' };
  }
}
