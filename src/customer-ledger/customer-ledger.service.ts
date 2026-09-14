import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CustomerLedger,
  CustomerLedgerDocument,
} from './schemas/customer-ledger.schema';
import {
  Customer,
  CustomerDocument,
} from '../customers/schemas/customer.schema';
import { CustomersService } from '../customers/customers.service';
import { CashBankEntriesService } from '../cash-bank-entries/cash-bank-entries.service';

@Injectable()
export class CustomerLedgerService {
  constructor(
    @InjectModel(CustomerLedger.name)
    private ledgerModel: Model<CustomerLedgerDocument>,
    @InjectModel(Customer.name)
    private customerModel: Model<CustomerDocument>,
    private readonly customersService: CustomersService,
    private readonly cashBankEntriesService: CashBankEntriesService,
  ) { }

  async onSaleCreated(sale: any) {
    if (!sale || !sale.customerName) {
      return null;
    }

    const date = sale.saleDate ? new Date(sale.saleDate) : new Date();
    const entries: any[] = [
      {
        customerName: sale.customerName,
        phone: sale.phone || '',
        type: 'sale',
        amount: sale.totalAmount,
        refSaleId: sale._id,
        date,
        mode: sale.paymentMode || 'cash',
      },
    ];

    if (sale.amountPaid > 0) {
      entries.push({
        customerName: sale.customerName,
        phone: sale.phone || '',
        type: 'payment',
        amount: sale.amountPaid,
        refSaleId: sale._id,
        date,
        mode: sale.paymentMode || 'cash',
        notes: 'Paid on sale',
      });
    }

    return this.ledgerModel.insertMany(entries);
  }

  async onSaleRemoved(saleId: string) {
    return this.ledgerModel.deleteMany({ refSaleId: saleId }).exec();
  }

  async onSaleUpdated(sale: any) {
    // First remove old entries for this sale
    await this.ledgerModel
      .deleteMany({ refSaleId: sale._id.toString() })
      .exec();
    // Then create new entries (same logic as onSaleCreated)
    return this.onSaleCreated(sale);
  }

  async recordPayment(dto: {
    customerName: string;
    phone?: string;
    amount: number;
    mode?: string;
    notes?: string;
    date?: Date | string;
    accountId?: string;
  }) {
    const entry = new this.ledgerModel({
      customerName: dto.customerName,
      phone: dto.phone || '',
      type: 'payment',
      amount: dto.amount,
      mode: dto.mode || 'cash',
      notes: dto.notes || '',
      date: dto.date ? new Date(dto.date) : new Date(),
    });
    const saved = await entry.save();

    if (dto.accountId) {
      await this.cashBankEntriesService.create({
        voucherType: 'receipt',
        accountId: dto.accountId,
        amount: dto.amount,
        date: dto.date as string | undefined,
        mode: dto.mode,
        notes: dto.notes || `Payment from ${dto.customerName}`,
        refType: 'customer',
        refId: dto.customerName,
        refName: dto.customerName,
      });
    }

    return saved;
  }

  async findAll(filters: {
    customerName?: string;
    phone?: string;
    from?: string;
    to?: string;
  }) {
    const query: any = {};
    if (filters.customerName) {
      query.customerName = { $regex: filters.customerName, $options: 'i' };
    }
    if (filters.phone) {
      query.phone = { $regex: filters.phone, $options: 'i' };
    }
    if (filters.from || filters.to) {
      query.date = {};
      if (filters.from) query.date.$gte = new Date(filters.from);
      if (filters.to) query.date.$lte = new Date(filters.to);
    }
    return this.ledgerModel.find(query).sort({ date: -1 }).exec();
  }

  async getSummary() {
    const rows = await this.ledgerModel
      .aggregate([
        {
          $group: {
            _id: { customerName: '$customerName', phone: '$phone' },
            totalSales: {
              $sum: { $cond: [{ $eq: ['$type', 'sale'] }, '$amount', 0] },
            },
            totalPaid: {
              $sum: { $cond: [{ $eq: ['$type', 'payment'] }, '$amount', 0] },
            },
            lastActivity: { $max: '$date' },
          },
        },
        {
          $project: {
            customerName: '$_id.customerName',
            phone: '$_id.phone',
            totalSales: 1,
            totalPaid: 1,
            balanceDue: { $subtract: ['$totalSales', '$totalPaid'] },
            lastActivity: 1,
          },
        },
        { $sort: { lastActivity: -1 } },
      ])
      .exec();

    // Enrich with customerId by looking up in Customers collection
    const enriched = await Promise.all(
      rows.map(async (r: any) => {
        let customerId: string | undefined;
        try {
          const customer = await this.customerModel
            .findOne({ name: r.customerName, phone: r.phone })
            .select('_id')
            .lean()
            .exec();
          if (customer) customerId = customer._id.toString();
        } catch {
          // ignore lookup errors
        }
        return {
          customerName: r.customerName,
          phone: r.phone,
          totalSales: r.totalSales,
          totalPaid: r.totalPaid,
          balanceDue: r.balanceDue,
          lastActivity: r.lastActivity,
          customerId,
        };
      }),
    );

    return enriched;
  }

  async getLedger(customerName: string, phone?: string) {
    const query: any = { customerName };
    if (phone) query.phone = phone;

    const entries = await this.ledgerModel.find(query).sort({ date: 1 }).exec();
    let runningBalance = 0;

    return entries.map((entry) => {
      runningBalance += entry.type === 'sale' ? entry.amount : -entry.amount;
      return {
        _id: entry._id,
        customerName: entry.customerName,
        phone: entry.phone,
        type: entry.type,
        amount: entry.amount,
        mode: entry.mode,
        notes: entry.notes,
        date: entry.date,
        refSaleId: entry.refSaleId,
        runningBalance,
      };
    });
  }
}
