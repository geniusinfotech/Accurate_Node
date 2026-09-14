import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateWorkerPaymentDto } from './dto/create-worker-payment.dto';
import { UpdateWorkerPaymentDto } from './dto/update-worker-payment.dto';
import {
  WorkerPayment,
  WorkerPaymentDocument,
} from './schemas/worker-payment.schema';
import {
  WorkBatch,
  WorkBatchDocument,
} from '../work-batches/schemas/work-batch.schema';
import { Worker, WorkerDocument } from '../workers/schemas/worker.schema';
import { CashBankEntriesService } from '../../cash-bank-entries/cash-bank-entries.service';

@Injectable()
export class WorkerPaymentsService {
  constructor(
    @InjectModel(WorkerPayment.name)
    private paymentModel: Model<WorkerPaymentDocument>,
    @InjectModel(WorkBatch.name)
    private workBatchModel: Model<WorkBatchDocument>,
    @InjectModel(Worker.name)
    private workerModel: Model<WorkerDocument>,
    private readonly cashBankEntriesService: CashBankEntriesService,
  ) {}

  async create(
    createDto: CreateWorkerPaymentDto,
  ): Promise<WorkerPaymentDocument> {
    const data: any = { ...createDto };

    // Auto-calc amountDue from the linked batch's making charge when the
    // caller didn't supply one explicitly, instead of leaving it at 0.
    if (data.amountDue == null && data.workBatchId) {
      const batch = await this.workBatchModel.findById(data.workBatchId).exec();
      if (batch?.totalMakingCharge) {
        data.amountDue = batch.totalMakingCharge;
      }
    }

    const created = new this.paymentModel(data);
    const saved = await created.save();

    const cashOut = (createDto.amountPaid || 0) + (createDto.advance || 0);
    if (createDto.accountId && cashOut > 0) {
      const worker = await this.workerModel.findById(createDto.workerId).exec();
      await this.cashBankEntriesService.create({
        voucherType: 'payment',
        accountId: createDto.accountId,
        amount: cashOut,
        date: createDto.date,
        mode: createDto.mode,
        notes: createDto.remarks || `Payment to ${worker?.name || 'worker'}`,
        refType: 'worker',
        refId: createDto.workerId,
        refName: worker?.name || '',
      });
    }

    return saved;
  }

  async findAll(): Promise<WorkerPaymentDocument[]> {
    return this.paymentModel
      .find()
      .populate('workerId')
      .populate('workBatchId')
      .exec();
  }

  async findOne(id: string): Promise<WorkerPaymentDocument> {
    const payment = await this.paymentModel
      .findById(id)
      .populate('workerId')
      .populate('workBatchId')
      .exec();
    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }
    return payment;
  }

  async findByBatch(batchId: string): Promise<WorkerPaymentDocument | null> {
    return this.paymentModel
      .findOne({ workBatchId: new Types.ObjectId(batchId) })
      .exec();
  }

  async update(
    id: string,
    updateDto: UpdateWorkerPaymentDto,
  ): Promise<WorkerPaymentDocument> {
    const updated = await this.paymentModel
      .findByIdAndUpdate(id, updateDto, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }
    return updated;
  }

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const result = await this.paymentModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }
    return { success: true, message: 'Payment deleted successfully' };
  }

  async getLedgerSummary(): Promise<any> {
    return this.paymentModel.aggregate([
      {
        $group: {
          _id: '$workerId',
          totalDue: { $sum: '$amountDue' },
          totalPaid: { $sum: '$amountPaid' },
          totalAdvance: { $sum: '$advance' },
          totalDeduction: { $sum: '$deduction' },
        },
      },
      {
        $lookup: {
          from: 'workers',
          localField: '_id',
          foreignField: '_id',
          as: 'worker',
        },
      },
      { $unwind: '$worker' },
      {
        $project: {
          workerId: '$_id',
          workerName: '$worker.name',
          workerType: '$worker.type',
          workerPhone: '$worker.phone',
          totalDue: 1,
          totalPaid: 1,
          totalAdvance: 1,
          totalDeduction: 1,
          duePending: {
            $subtract: ['$totalDue', '$totalPaid'],
          },
          netPending: {
            $subtract: [
              { $subtract: ['$totalDue', '$totalPaid'] },
              { $subtract: ['$totalAdvance', '$totalDeduction'] },
            ],
          },
        },
      },
    ]);
  }
}
