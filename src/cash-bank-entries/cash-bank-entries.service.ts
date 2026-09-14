import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CashBankEntry,
  CashBankEntryDocument,
} from './schemas/cash-bank-entry.schema';
import { CreateCashBankEntryDto } from './dto/create-cash-bank-entry.dto';

@Injectable()
export class CashBankEntriesService {
  constructor(
    @InjectModel(CashBankEntry.name)
    private entryModel: Model<CashBankEntryDocument>,
  ) {}

  async create(dto: CreateCashBankEntryDto): Promise<CashBankEntryDocument> {
    const created = new this.entryModel({
      ...dto,
      accountId: new Types.ObjectId(dto.accountId),
      date: dto.date ? new Date(dto.date) : new Date(),
    });
    return created.save();
  }

  async findAll(filters: {
    accountId?: string;
    voucherType?: 'receipt' | 'payment';
    from?: string;
    to?: string;
  }): Promise<CashBankEntryDocument[]> {
    const query: any = {};
    if (filters.accountId) query.accountId = filters.accountId;
    if (filters.voucherType) query.voucherType = filters.voucherType;
    if (filters.from || filters.to) {
      query.date = {};
      if (filters.from) query.date.$gte = new Date(filters.from);
      if (filters.to) query.date.$lte = new Date(`${filters.to}T23:59:59.999`);
    }
    return this.entryModel
      .find(query)
      .populate('accountId', 'name type')
      .sort({ date: -1, createdAt: -1 })
      .exec();
  }

  async countForAccount(accountId: string): Promise<number> {
    return this.entryModel.countDocuments({ accountId }).exec();
  }

  async cancel(id: string): Promise<CashBankEntryDocument> {
    const updated = await this.entryModel
      .findByIdAndUpdate(id, { cancelled: true }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException(`Voucher ${id} not found`);
    return updated;
  }

  async remove(id: string): Promise<{ success: boolean }> {
    const result = await this.entryModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException(`Voucher ${id} not found`);
    return { success: true };
  }
}
