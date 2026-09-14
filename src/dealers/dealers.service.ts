import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Dealer, DealerDocument } from './schemas/dealer.schema';
import {
  DealerLedger,
  DealerLedgerDocument,
} from './schemas/dealer-ledger.schema';
import {
  RawMaterial,
  RawMaterialDocument,
} from '../manufacturing/raw-materials/schemas/raw-material.schema';
import { CreateDealerDto } from './dto/create-dealer.dto';
import { UpdateDealerDto } from './dto/update-dealer.dto';
import { CreateDealerLedgerDto } from './dto/create-dealer-ledger.dto';
import { CashBankEntriesService } from '../cash-bank-entries/cash-bank-entries.service';

@Injectable()
export class DealersService {
  constructor(
    @InjectModel(Dealer.name) private dealerModel: Model<DealerDocument>,
    @InjectModel(DealerLedger.name)
    private dealerLedgerModel: Model<DealerLedgerDocument>,
    @InjectModel(RawMaterial.name)
    private rawMaterialModel: Model<RawMaterialDocument>,
    private readonly cashBankEntriesService: CashBankEntriesService,
  ) { }

  async createDealer(
    createDealerDto: CreateDealerDto,
  ): Promise<DealerDocument> {
    const created = new this.dealerModel(createDealerDto);
    return created.save();
  }

  async findAllDealers(): Promise<DealerDocument[]> {
    return this.dealerModel.find().exec();
  }

  async findDealerById(id: string): Promise<DealerDocument> {
    const dealer = await this.dealerModel.findById(id).exec();
    if (!dealer) {
      throw new NotFoundException(`Dealer with ID ${id} not found`);
    }
    return dealer;
  }

  async updateDealer(
    id: string,
    updateDealerDto: UpdateDealerDto,
  ): Promise<DealerDocument> {
    const updated = await this.dealerModel
      .findByIdAndUpdate(id, updateDealerDto, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(`Dealer with ID ${id} not found`);
    }
    return updated;
  }

  async removeDealer(
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    const result = await this.dealerModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Dealer with ID ${id} not found`);
    }
    return { success: true, message: 'Dealer deleted successfully' };
  }

  async addLedgerEntry(
    createLedgerDto: CreateDealerLedgerDto,
  ): Promise<DealerLedgerDocument> {
    const dealer = await this.dealerModel
      .findById(createLedgerDto.dealerId)
      .exec();
    if (!dealer) {
      throw new NotFoundException(
        `Dealer with ID ${createLedgerDto.dealerId} not found`,
      );
    }

    const payload: any = {
      ...createLedgerDto,
      dealerId: new Types.ObjectId(createLedgerDto.dealerId),
    };

    if (createLedgerDto.refPurchaseId) {
      payload.refPurchaseId = new Types.ObjectId(createLedgerDto.refPurchaseId);
    }

    const created = new this.dealerLedgerModel(payload);
    const saved = await created.save();

    if (createLedgerDto.type === 'payment' && createLedgerDto.accountId) {
      await this.cashBankEntriesService.create({
        voucherType: 'payment',
        accountId: createLedgerDto.accountId,
        amount: createLedgerDto.amount,
        date: createLedgerDto.date,
        mode: createLedgerDto.mode,
        notes: createLedgerDto.notes || `Payment to ${dealer.name}`,
        refType: 'dealer',
        refId: dealer._id.toString(),
        refName: dealer.name,
      });
    }

    return saved;
  }

  async getLedger(dealerId: string): Promise<any> {
    const dealer = await this.findDealerById(dealerId);

    // 1. Fetch raw material purchases matching dealerId or dealerName (case-insensitive)
    const rawMaterials = await this.rawMaterialModel
      .find({
        $or: [
          { dealerId: new Types.ObjectId(dealerId) },
          { dealerName: new RegExp(`^${dealer.name.trim()}$`, 'i') },
        ],
      })
      .exec();

    // 2. Fetch dealer ledger entries (payments & explicit purchases)
    const ledgerEntries = await this.dealerLedgerModel
      .find({
        $or: [
          { dealerId: dealerId },
          { dealerId: new Types.ObjectId(dealerId) },
        ],
      })
      .exec();

    const combined: any[] = [];
    const rmIds = new Set<string>();

    rawMaterials.forEach((rm) => {
      rmIds.add(rm._id.toString());
      combined.push({
        _id: rm._id,
        type: 'purchase',
        amount: rm.totalAmount || rm.quantity * rm.pricePerKg || 0,
        date: rm.purchaseDate || (rm as any).createdAt,
        notes: `Raw Material: ${rm.materialName} (${rm.quantity} kg @ ₹${rm.pricePerKg}/kg)`,
        reference: rm.reference || rm.lotId || '-',
        refPurchaseId: rm._id,
      });
    });

    ledgerEntries.forEach((le) => {
      const refId = le.refPurchaseId?.toString();
      if (refId && rmIds.has(refId)) {
        return; // skip duplicate entry
      }
      combined.push({
        _id: le._id,
        type: le.type,
        amount: le.amount,
        date: le.date || (le as any).createdAt,
        mode: le.mode,
        notes: le.notes || '-',
        reference: le.notes || '-',
        refPurchaseId: le.refPurchaseId,
      });
    });

    combined.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    let totalPurchases = 0;
    let totalPayments = 0;

    const itemized = combined.map((entry) => {
      if (entry.type === 'purchase') {
        totalPurchases += entry.amount;
      } else if (entry.type === 'payment') {
        totalPayments += entry.amount;
      }
      return {
        ...entry,
        runningBalance: totalPurchases - totalPayments,
      };
    });

    return {
      dealer,
      totalPurchases,
      totalPayments,
      balanceDue: totalPurchases - totalPayments,
      ledger: itemized,
    };
  }

  async getLedgerSummary(): Promise<any[]> {
    const dealers = await this.dealerModel.find().exec();
    const summaries = await Promise.all(
      dealers.map(async (dealer) => {
        const ledger = await this.getLedger(dealer._id.toString());
        // ledger.ledger is sorted oldest first, so the tail is the latest
        // movement — the accounts screen shows it as "Last Activity".
        const latestEntry = ledger.ledger[ledger.ledger.length - 1];
        return {
          dealerId: dealer._id,
          dealerName: dealer.name,
          dealerPhone: dealer.phone,
          totalPurchases: ledger.totalPurchases,
          totalPayments: ledger.totalPayments,
          balanceDue: ledger.balanceDue,
          lastActivity: latestEntry?.date ?? null,
        };
      }),
    );
    return summaries;
  }

  async searchDealers(query?: string): Promise<any[]> {
    const trimmed = (query || '').trim();
    let queryFilter: any = {};
    if (trimmed.length > 0) {
      const searchRegex = new RegExp(trimmed, 'i');
      queryFilter = {
        $or: [{ name: searchRegex }, { phone: searchRegex }],
      };
    }

    const dealers = await this.dealerModel
      .find(queryFilter)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(20)
      .exec();

    // Get balance due for each dealer
    const summaries = await this.getLedgerSummary();
    const balanceMap = new Map(
      summaries.map((s) => [s.dealerId.toString(), s.balanceDue]),
    );

    return dealers.map((d) => ({
      _id: d._id,
      name: d.name,
      phone: d.phone || '',
      address: d.address || '',
      notes: d.notes || '',
      balanceDue: balanceMap.get(d._id.toString()) || 0,
    }));
  }
}
