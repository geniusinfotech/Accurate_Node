import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CashBankAccount,
  CashBankAccountDocument,
} from './schemas/cash-bank-account.schema';
import { CreateCashBankAccountDto } from './dto/create-cash-bank-account.dto';
import { UpdateCashBankAccountDto } from './dto/update-cash-bank-account.dto';
import { CashBankEntriesService } from '../cash-bank-entries/cash-bank-entries.service';

@Injectable()
export class CashBankAccountsService {
  constructor(
    @InjectModel(CashBankAccount.name)
    private accountModel: Model<CashBankAccountDocument>,
    private readonly entriesService: CashBankEntriesService,
  ) {}

  async create(
    dto: CreateCashBankAccountDto,
  ): Promise<CashBankAccountDocument> {
    const existing = await this.accountModel
      .findOne({ name: new RegExp(`^${dto.name.trim()}$`, 'i') })
      .exec();
    if (existing) {
      throw new ConflictException(`Account "${dto.name}" already exists`);
    }
    const created = new this.accountModel(dto);
    return created.save();
  }

  async findAll(search?: string): Promise<any[]> {
    const query: any = {};
    const trimmed = (search || '').trim();
    if (trimmed) {
      const regex = new RegExp(trimmed, 'i');
      query.$or = [{ name: regex }, { bankName: regex }];
    }
    const accounts = await this.accountModel
      .find(query)
      .sort({ type: 1, name: 1 })
      .exec();

    return Promise.all(
      accounts.map(async (a) => {
        const balance = await this.computeBalance(a);
        return { ...a.toObject(), currentBalance: balance };
      }),
    );
  }

  async findById(id: string): Promise<CashBankAccountDocument> {
    const account = await this.accountModel.findById(id).exec();
    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }
    return account;
  }

  async update(
    id: string,
    dto: UpdateCashBankAccountDto,
  ): Promise<CashBankAccountDocument> {
    if (dto.name) {
      const existing = await this.accountModel
        .findOne({
          _id: { $ne: id },
          name: new RegExp(`^${dto.name.trim()}$`, 'i'),
        })
        .exec();
      if (existing) {
        throw new ConflictException(`Account "${dto.name}" already exists`);
      }
    }
    const updated = await this.accountModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }
    return updated;
  }

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const entryCount = await this.entriesService.countForAccount(id);
    if (entryCount > 0) {
      throw new BadRequestException(
        'Cannot delete an account that has voucher entries. Deactivate it instead.',
      );
    }
    const result = await this.accountModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }
    return { success: true, message: 'Account deleted successfully' };
  }

  private async computeBalance(account: CashBankAccountDocument) {
    const entries = await this.entriesService.findAll({
      accountId: account._id.toString(),
    });
    let balance = account.openingBalance || 0;
    for (const e of entries) {
      if (e.cancelled) continue;
      balance += e.voucherType === 'receipt' ? e.amount : -e.amount;
    }
    return balance;
  }

  async getLedger(id: string): Promise<any> {
    const account = await this.findById(id);
    const entries = await this.entriesService.findAll({ accountId: id });
    const sorted = entries
      .slice()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let balance = account.openingBalance || 0;
    const itemized = sorted.map((e) => {
      if (!e.cancelled) {
        balance += e.voucherType === 'receipt' ? e.amount : -e.amount;
      }
      return { ...e.toObject(), runningBalance: balance };
    });

    return {
      account,
      openingBalance: account.openingBalance || 0,
      currentBalance: balance,
      entries: itemized,
    };
  }
}
