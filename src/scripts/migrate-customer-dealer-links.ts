import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Sale, SaleDocument } from '../sales/schemas/sale.schema';
import {
  Customer,
  CustomerDocument,
} from '../customers/schemas/customer.schema';
import { Dealer, DealerDocument } from '../dealers/schemas/dealer.schema';
import {
  CustomerLedger,
  CustomerLedgerDocument,
} from '../customer-ledger/schemas/customer-ledger.schema';

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    @InjectModel(Sale.name) private saleModel: Model<SaleDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(Dealer.name) private dealerModel: Model<DealerDocument>,
    @InjectModel(CustomerLedger.name)
    private customerLedgerModel: Model<CustomerLedgerDocument>,
  ) {}

  async migrateCustomerDealerLinks(): Promise<void> {
    this.logger.log('Starting customer-dealer link migration...');

    const customerMap = new Map<string, Types.ObjectId>();
    const dealerMap = new Map<string, Types.ObjectId>();

    const uniqueCustomers = await this.getUniqueCustomers();
    this.logger.log(
      `Found ${uniqueCustomers.length} unique customers from sales and ledger`,
    );

    for (const { customerName, phone } of uniqueCustomers) {
      const cleanPhone = phone.trim().replace(/\s+/g, '');
      const cleanName = customerName.trim();

      if (!cleanName || !cleanPhone) continue;

      const key = `${cleanName}|${cleanPhone}`;
      let customerId = customerMap.get(key);

      if (!customerId) {
        let customer = await this.customerModel
          .findOne({ name: cleanName, phone: cleanPhone })
          .exec();

        if (!customer) {
          customer = await this.customerModel.create({
            name: cleanName,
            phone: cleanPhone,
            address: '',
            gstin: '',
            notes: '',
          });
          this.logger.log(`Created new customer: ${cleanName} (${cleanPhone})`);
        }

        customerId = customer._id;
        customerMap.set(key, customerId);
      }
    }

    const dealers = await this.dealerModel.find().select('name').exec();
    for (const dealer of dealers) {
      dealerMap.set(dealer.name.trim().toLowerCase(), dealer._id);
    }
    this.logger.log(`Loaded ${dealerMap.size} dealers for matching`);

    const salesWithoutCustomerId = await this.saleModel
      .find({ customerId: { $exists: false } })
      .exec();

    this.logger.log(
      `Found ${salesWithoutCustomerId.length} sales without customerId`,
    );

    let updatedCount = 0;
    let dealerLinkedCount = 0;

    for (const sale of salesWithoutCustomerId) {
      const cleanPhone = (sale.phone || '').trim().replace(/\s+/g, '');
      const cleanName = (sale.customerName || '').trim();

      if (!cleanName || !cleanPhone) {
        this.logger.warn(
          `Sale ${sale.saleNumber} missing customerName or phone, skipping`,
        );
        continue;
      }

      const key = `${cleanName}|${cleanPhone}`;
      const customerId = customerMap.get(key);

      if (!customerId) {
        this.logger.warn(
          `No customer found for ${key}, skipping sale ${sale.saleNumber}`,
        );
        continue;
      }

      let dealerId: Types.ObjectId | undefined;
      if (sale.shopName) {
        const shopNameLower = sale.shopName.trim().toLowerCase();
        dealerId = dealerMap.get(shopNameLower);
      }

      await this.saleModel
        .findByIdAndUpdate(sale._id, {
          customerId,
          dealerId,
        })
        .exec();

      updatedCount++;
      if (dealerId) dealerLinkedCount++;
    }

    this.logger.log(
      `Migration complete: ${updatedCount} sales updated, ${dealerLinkedCount} linked to dealers`,
    );
  }

  private async getUniqueCustomers(): Promise<
    Array<{ customerName: string; phone: string }>
  > {
    const salesPairs = await this.saleModel.aggregate([
      { $group: { _id: { customerName: '$customerName', phone: '$phone' } } },
      { $project: { customerName: '$_id.customerName', phone: '$_id.phone' } },
    ]);

    const ledgerPairs = await this.customerLedgerModel.aggregate([
      { $group: { _id: { customerName: '$customerName', phone: '$phone' } } },
      { $project: { customerName: '$_id.customerName', phone: '$_id.phone' } },
    ]);

    const combined = [...salesPairs, ...ledgerPairs];
    const uniqueMap = new Map<
      string,
      { customerName: string; phone: string }
    >();

    for (const pair of combined) {
      const key = `${pair.customerName}|${pair.phone}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, {
          customerName: pair.customerName,
          phone: pair.phone,
        });
      }
    }

    return Array.from(uniqueMap.values());
  }
}
