import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateWorkBatchDto } from './dto/create-work-batch.dto';
import { UpdateWorkBatchDto } from './dto/update-work-batch.dto';
import { AddWorkBatchCompletionDto } from './dto/add-work-batch-completion.dto';
import { WorkBatch, WorkBatchDocument } from './schemas/work-batch.schema';
import {
  RawMaterial,
  RawMaterialDocument,
} from '../raw-materials/schemas/raw-material.schema';
import { Worker, WorkerDocument } from '../workers/schemas/worker.schema';
import { SemiFinishedStockService } from '../semi-finished-stock/semi-finished-stock.service';
import { RawMaterialsService } from '../raw-materials/raw-materials.service';

type StockTarget = { kind: 'raw' | 'semi'; id: string; amount: number } | null;

@Injectable()
export class WorkBatchesService {
  private readonly logger = new Logger(WorkBatchesService.name);

  constructor(
    @InjectModel(WorkBatch.name)
    private workBatchModel: Model<WorkBatchDocument>,
    @InjectModel(RawMaterial.name)
    private rawMaterialModel: Model<RawMaterialDocument>,
    @InjectModel(Worker.name) private workerModel: Model<WorkerDocument>,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly rawMaterialsService: RawMaterialsService,
    private readonly semiFinishedStockService: SemiFinishedStockService,
  ) {}

  async createWithStockDeduction(
    dto: CreateWorkBatchDto,
    stockId: string,
    stockAmount: number,
    semiFinishedStockService: SemiFinishedStockService,
  ) {
    // deduct first — if this fails, we never create the batch
    await semiFinishedStockService.decrementQuantityAtomic(
      stockId,
      stockAmount,
    );
    try {
      return await this.create(dto);
    } catch (err) {
      // rollback stock on batch-creation failure
      await semiFinishedStockService.incrementQuantity(stockId, stockAmount);
      throw err;
    }
  }

  async create(
    createWorkBatchDto: CreateWorkBatchDto,
  ): Promise<WorkBatchDocument> {
    const data: any = { ...createWorkBatchDto };
    if (
      data.totalMakingCharge == null &&
      data.makingChargePerPcs != null &&
      data.returnedPcs != null
    ) {
      data.totalMakingCharge = data.makingChargePerPcs * data.returnedPcs;
    }

    if (!data.lotId) {
      if (data.rawMaterialId) {
        const rm = await this.rawMaterialModel
          .findById(data.rawMaterialId)
          .exec();
        if (rm?.lotId) {
          data.lotId = rm.lotId;
        }
      } else if (data.parentBatchId) {
        const pb = await this.workBatchModel
          .findById(data.parentBatchId)
          .exec();
        if (pb?.lotId) {
          data.lotId = pb.lotId;
        }
      }
    }

    // Kg-in stage: atomically deduct raw material stock before writing the batch.
    // Applies to any issuance of raw material (raw->chain and manual polish/refine issues).
    const isRawIssuance = !!data.rawMaterialId && !data.semiFinishedStockId;
    if (isRawIssuance && data.kgGivenOut) {
      await this.rawMaterialsService.decrementQuantityAtomic(
        data.rawMaterialId,
        data.kgGivenOut,
      );
      try {
        const created = new this.workBatchModel(data);
        return await created.save();
      } catch (err) {
        await this.rawMaterialsService.incrementQuantity(
          data.rawMaterialId,
          data.kgGivenOut,
        );
        throw err;
      }
    }

    if (
      !isRawIssuance &&
      data.stage !== 'raw->chain' &&
      data.semiFinishedStockId
    ) {
      const stockAmount =
        data.pcsGivenOut > 0 ? data.pcsGivenOut : data.kgGivenOut;
      await this.semiFinishedStockService.decrementQuantityAtomic(
        data.semiFinishedStockId,
        stockAmount,
      );
      try {
        const created = new this.workBatchModel(data);
        return await created.save();
      } catch (err) {
        await this.semiFinishedStockService.incrementQuantity(
          data.semiFinishedStockId,
          stockAmount,
        );
        throw err;
      }
    }

    const created = new this.workBatchModel(data);
    return created.save();
  }

  async findAll(): Promise<WorkBatchDocument[]> {
    return this.workBatchModel
      .find()
      .populate('workerId')
      .populate('rawMaterialId')
      .populate('semiFinishedStockId')
      .populate('parentBatchId')
      .exec();
  }

  async findOne(id: string): Promise<WorkBatchDocument> {
    const workBatch = await this.workBatchModel
      .findById(id)
      .populate('workerId')
      .populate('rawMaterialId')
      .populate('semiFinishedStockId')
      .populate('parentBatchId')
      .exec();
    if (!workBatch) {
      throw new NotFoundException(`WorkBatch with ID ${id} not found`);
    }
    return workBatch;
  }

  async addCompletion(
    id: string,
    completionDto: AddWorkBatchCompletionDto,
  ): Promise<WorkBatchDocument> {
    const batch = await this.workBatchModel.findById(id).exec();
    if (!batch) {
      throw new NotFoundException(`WorkBatch with ID ${id} not found`);
    }

    const entry: any = {
      date: completionDto.date ? new Date(completionDto.date) : new Date(),
      pcsReturned: completionDto.pcsReturned || 0,
      weightReturned: completionDto.weightReturned || 0,
      defectCount: completionDto.defectCount || 0,
      note: completionDto.note || '',
    };

    if (completionDto.addedToStockId) {
      entry.addedToStockId = new Types.ObjectId(completionDto.addedToStockId);
    }

    batch.completions.push(entry);

    // Recalculate totals from completions
    const totalPcs = batch.completions.reduce(
      (acc, cur) => acc + (cur.pcsReturned || 0),
      0,
    );
    const totalWeight = batch.completions.reduce(
      (acc, cur) => acc + (cur.weightReturned || 0),
      0,
    );
    const totalDefect = batch.completions.reduce(
      (acc, cur) => acc + (cur.defectCount || 0),
      0,
    );

    batch.returnedPcs = totalPcs;
    batch.returnedWeight = totalWeight;
    batch.returnedQuantity = totalPcs > 0 ? totalPcs : totalWeight;
    batch.defectCount = totalDefect;

    await this.applyMakingCharge(
      batch,
      completionDto.makingChargePerPcs,
      completionDto.totalMakingCharge,
      totalPcs,
      totalWeight,
    );

    if (completionDto.note) {
      batch.returnNotes = completionDto.note;
    }

    // Compute Loss % server-side
    this.recomputeLossAndStatus(batch, completionDto.isFinal);

    const saved = await batch.save();
    this.checkAndEmitHighLossEvent(saved);
    return saved;
  }

  async update(
    id: string,
    updateWorkBatchDto: UpdateWorkBatchDto,
  ): Promise<WorkBatchDocument> {
    const batch = await this.workBatchModel.findById(id).exec();
    if (!batch) {
      throw new NotFoundException(`WorkBatch with ID ${id} not found`);
    }

    // Snapshot the stock this batch currently holds against, before any
    // field changes, so we can reconcile inventory if the edit changes
    // kgGivenOut / pcsGivenOut / rawMaterialId / semiFinishedStockId / stage.
    const before = this.resolveStockTarget(batch);

    Object.assign(batch, updateWorkBatchDto);

    const after = this.resolveStockTarget(batch);
    await this.reconcileStockOnUpdate(before, after);

    await this.applyMakingCharge(
      batch,
      updateWorkBatchDto.makingChargePerPcs,
      updateWorkBatchDto.totalMakingCharge,
      batch.returnedPcs || 0,
      batch.returnedWeight || 0,
    );

    this.recomputeLossAndStatus(batch);

    const saved = await batch.save();
    this.checkAndEmitHighLossEvent(saved);
    return saved;
  }

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const result = await this.workBatchModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`WorkBatch with ID ${id} not found`);
    }

    // Restore whatever stock was deducted when this batch was created,
    // mirroring the deduction logic in create() so deleting a batch
    // never leaves raw material / semi-finished stock permanently short.
    const target = this.resolveStockTarget(result);
    if (target) {
      await this.incrementStock(target.kind, target.id, target.amount);
    }

    return { success: true, message: 'Work batch deleted successfully' };
  }

  /**
   * Which stock document (and how much) this batch's kgGivenOut/pcsGivenOut
   * currently represent a deduction against — mirrors the branching in create().
   */
  private resolveStockTarget(
    batch: Pick<
      WorkBatch,
      | 'rawMaterialId'
      | 'semiFinishedStockId'
      | 'stage'
      | 'kgGivenOut'
      | 'pcsGivenOut'
    >,
  ): StockTarget {
    const isRawIssuance = !!batch.rawMaterialId && !batch.semiFinishedStockId;
    if (isRawIssuance && batch.rawMaterialId && batch.kgGivenOut) {
      return {
        kind: 'raw',
        id: batch.rawMaterialId.toString(),
        amount: batch.kgGivenOut,
      };
    }
    if (
      !isRawIssuance &&
      batch.stage !== 'raw->chain' &&
      batch.semiFinishedStockId
    ) {
      const amount =
        batch.pcsGivenOut > 0 ? batch.pcsGivenOut : batch.kgGivenOut;
      if (amount) {
        return {
          kind: 'semi',
          id: batch.semiFinishedStockId.toString(),
          amount,
        };
      }
    }
    return null;
  }

  private async decrementStock(
    kind: 'raw' | 'semi',
    id: string,
    amount: number,
  ): Promise<void> {
    if (!amount) return;
    if (kind === 'raw') {
      await this.rawMaterialsService.decrementQuantityAtomic(id, amount);
    } else {
      await this.semiFinishedStockService.decrementQuantityAtomic(id, amount);
    }
  }

  private async incrementStock(
    kind: 'raw' | 'semi',
    id: string,
    amount: number,
  ): Promise<void> {
    if (!amount) return;
    if (kind === 'raw') {
      await this.rawMaterialsService.incrementQuantity(id, amount);
    } else {
      await this.semiFinishedStockService.incrementQuantity(id, amount);
    }
  }

  /**
   * Reconciles stock when an edit to a batch changes what it's deducted
   * against (kgGivenOut, pcsGivenOut, rawMaterialId, semiFinishedStockId, or
   * stage). Without this, update() could silently desync inventory from
   * what was actually issued.
   */
  private async reconcileStockOnUpdate(
    before: StockTarget,
    after: StockTarget,
  ): Promise<void> {
    const sameTarget =
      before && after && before.kind === after.kind && before.id === after.id;

    if (sameTarget) {
      const delta = after.amount - before.amount;
      if (delta > 0) {
        await this.decrementStock(after.kind, after.id, delta);
      } else if (delta < 0) {
        await this.incrementStock(after.kind, after.id, -delta);
      }
      return;
    }

    // Target changed (different material/stock doc, or issuance type
    // flipped): consume the new target first — if there isn't enough stock
    // this throws and the update aborts before anything is restored or saved.
    if (after) {
      await this.decrementStock(after.kind, after.id, after.amount);
    }
    if (before) {
      await this.incrementStock(before.kind, before.id, before.amount);
    }
  }

  /**
   * Resolves the making-charge rate/total for a batch. Priority: explicit
   * DTO values > a rate already set on the batch > the assigned worker's
   * configured rate (rateConfig.perPcs for piece-tracked work, perKg for
   * weight-tracked work) as a last-resort default.
   */
  private async applyMakingCharge(
    batch: WorkBatchDocument,
    dtoMakingChargePerPcs: number | null | undefined,
    dtoTotalMakingCharge: number | null | undefined,
    totalPcs: number,
    totalWeight: number,
  ): Promise<void> {
    if (dtoMakingChargePerPcs != null) {
      batch.makingChargePerPcs = dtoMakingChargePerPcs;
    }

    if (dtoTotalMakingCharge != null) {
      batch.totalMakingCharge = dtoTotalMakingCharge;
      return;
    }

    if (batch.makingChargePerPcs > 0) {
      batch.totalMakingCharge = batch.makingChargePerPcs * totalPcs;
      return;
    }

    const worker = await this.workerModel.findById(batch.workerId).exec();
    const rate = worker?.rateConfig;
    if (!rate) return;

    if (totalPcs > 0 && rate.perPcs > 0) {
      batch.makingChargePerPcs = rate.perPcs;
      batch.totalMakingCharge = rate.perPcs * totalPcs;
    } else if (totalWeight > 0 && rate.perKg > 0) {
      batch.totalMakingCharge = rate.perKg * totalWeight;
    }
  }

  private recomputeLossAndStatus(
    batch: WorkBatchDocument,
    isFinal?: boolean,
  ): void {
    if (batch.kgGivenOut > 0) {
      const returnedEquivalent =
        batch.returnedWeight > 0 ? batch.returnedWeight : 0;
      const loss =
        ((batch.kgGivenOut - returnedEquivalent) / batch.kgGivenOut) * 100;
      batch.lossPercent = Math.max(0, Number(loss.toFixed(2)));
    } else {
      batch.lossPercent = 0;
    }

    const remainingWeight = batch.kgGivenOut - batch.returnedWeight;

    // Piece-based reconciliation, when the assigned piece count is known:
    // remaining = pcsGivenOut - (returnedPcs + defectCount)
    // If remaining <= 0 the batch is fully accounted for (done), otherwise partial.
    const hasPcsTarget = batch.pcsGivenOut > 0;
    const accountedPcs = (batch.returnedPcs || 0) + (batch.defectCount || 0);
    const remainingPcs = hasPcsTarget
      ? batch.pcsGivenOut - accountedPcs
      : remainingWeight;
    const fullyReturned = isFinal || remainingPcs <= 0.001;

    if (fullyReturned) {
      batch.status = 'returned';
      if (!batch.dateIn) {
        batch.dateIn = new Date();
      }
    } else if (batch.completions && batch.completions.length > 0) {
      batch.status = 'partial';
    }
  }

  private checkAndEmitHighLossEvent(batch: WorkBatchDocument): void {
    const threshold = this.configService.get<number>(
      'LOSS_ALERT_THRESHOLD_PCT',
      5,
    );
    if (batch.lossPercent > threshold) {
      this.logger.warn(
        `High loss alert! Work batch ${batch._id} (Lot: ${batch.lotId}) loss is ${batch.lossPercent}% (Threshold: ${threshold}%)`,
      );
      this.eventEmitter.emit('work.highLoss', {
        batchId: batch._id.toString(),
        lotId: batch.lotId,
        lossPercent: batch.lossPercent,
        threshold,
        workerId: batch.workerId ? batch.workerId.toString() : null,
      });
    }
  }
}
