import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Sale, SaleDocument } from './schemas/sale.schema';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ShopProductsService } from '../shop-products/services/shop-products.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { CustomerLedgerService } from '../customer-ledger/customer-ledger.service';
import { CustomersService } from '../customers/customers.service';
import { Dealer, DealerDocument } from '../dealers/schemas/dealer.schema';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    @InjectModel(Sale.name) private saleModel: Model<SaleDocument>,
    @InjectModel(Dealer.name) private dealerModel: Model<DealerDocument>,
    private readonly shopProductsService: ShopProductsService,
    private readonly analyticsService: AnalyticsService,
    private readonly customerLedgerService: CustomerLedgerService,
    private readonly customersService: CustomersService,
  ) {}

  private getDiwaliYear(year: number, now: Date): number {
    const diwaliReference = new Date(year, 10, 1);
    return now < diwaliReference ? year - 1 : year;
  }

  private saleNumberPrefix(date: Date): string {
    const year = date.getFullYear();
    const diwaliYear = this.getDiwaliYear(year, date);
    const mmdd =
      String(date.getMonth() + 1).padStart(2, '0') +
      String(date.getDate()).padStart(2, '0');
    return `SALE-${diwaliYear}-${mmdd}-`;
  }

  private async generateSaleNumber(): Promise<string> {
    const prefix = this.saleNumberPrefix(new Date());
    // The sequence comes from the highest number already issued under today's
    // prefix, never from a document count: counting breaks as soon as a bill is
    // deleted or back-dated, and then every following bill collides with the
    // unique saleNumber index.
    const issued = await this.saleModel
      .find({ saleNumber: { $regex: `^${prefix}\\d+$` } })
      .select('saleNumber')
      .lean()
      .exec();
    const lastSeq = issued.reduce((max, sale) => {
      const seq = Number.parseInt(sale.saleNumber.slice(prefix.length), 10);
      return Number.isFinite(seq) && seq > max ? seq : max;
    }, 0);
    return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`;
  }

  async getNextSaleNumber(): Promise<{ saleNumber: string }> {
    const saleNumber = await this.generateSaleNumber();
    return { saleNumber };
  }

  /**
   * Confirm every product on the bill still exists.
   *
   * Counter sales are allowed to oversell — stock is free to go negative so a
   * sale is never blocked for a shop that's still waiting on a delivery — so
   * this no longer checks quantity against stock, only that the product is
   * real. Call this only when the figures in the database already reflect
   * what is available to this bill — for an edit that means after the old
   * quantities have been restored.
   */
  private async assertProductsExist(
    items: Array<{ productId: string; quantity: number }>,
  ): Promise<void> {
    const ids = new Set(items.map((item) => String(item.productId)));

    for (const productId of ids) {
      // includeUnpublished: true — a sale can legitimately include a product
      // that isn't "published" to the storefront (e.g. still pending review).
      // findById() throws NotFoundException rather than returning null, so
      // without this flag a perfectly real product looks "missing" just
      // because it isn't published yet.
      try {
        await this.shopProductsService.findById(productId, {
          includeUnpublished: true,
        });
      } catch {
        throw new NotFoundException(
          'One of the products in this sale could not be found — it may have been deleted. Please remove it from the sale and select another product.',
        );
      }
    }
  }

  async create(
    createSaleDto: CreateSaleDto,
    userId?: string,
  ): Promise<SaleDocument> {
    if (!createSaleDto.items || createSaleDto.items.length === 0) {
      throw new BadRequestException('A sale must contain at least one item');
    }

    // Confirm every product is real before writing anything. Stock itself is
    // no longer checked here — selling below zero is allowed.
    await this.assertProductsExist(createSaleDto.items);

    let totalAmount = 0;
    const items: any[] = [];
    const deductedItems: Array<{ productId: string; quantity: number }> = [];

    try {
      for (const item of createSaleDto.items) {
        const linePrice = item.price;
        const lineSubtotal = linePrice * item.quantity;
        totalAmount += lineSubtotal;

        const updated = await this.shopProductsService.deductStock(
          item.productId,
          item.quantity,
        );
        deductedItems.push({
          productId: item.productId,
          quantity: item.quantity,
        });

        items.push({
          productId: new Types.ObjectId(item.productId),
          name: item.name || updated.name,
          sku: item.sku || updated.sku,
          quantity: item.quantity,
          price: linePrice,
          subtotal: lineSubtotal,
          categoryId: updated.shopCategoryId?.toString(),
        });
      }

      const discount = createSaleDto.discount || 0;
      const freight = createSaleDto.freight || 0;
      const billAmount = Math.max(0, totalAmount + freight - discount);
      // Credit: default 0 (fully due), allow partial 0..billAmount.
      // Cash/UPI/Card/Other: default billAmount (fully paid) if not provided.
      let amountPaid: number;
      if (
        createSaleDto.amountPaid !== undefined &&
        createSaleDto.amountPaid !== null
      ) {
        amountPaid = Number(createSaleDto.amountPaid);
        if (isNaN(amountPaid) || amountPaid < 0) {
          throw new BadRequestException('amountPaid must be >= 0');
        }
        // Clamp over-payment to billAmount (alternatively throw)
        if (amountPaid > billAmount) amountPaid = billAmount;
      } else {
        amountPaid = createSaleDto.paymentMode === 'credit' ? 0 : billAmount;
      }
      const balanceDue = Math.max(0, billAmount - amountPaid);

      const explicitSaleNumber =
        createSaleDto.saleNumber && createSaleDto.saleNumber.trim().length > 0
          ? createSaleDto.saleNumber.trim()
          : null;
      const saleNumber = explicitSaleNumber ?? (await this.generateSaleNumber());

      const sale = new this.saleModel({
        saleNumber,
        customerName: createSaleDto.customerName || '',
        phone: createSaleDto.phone || '',
        shopName: createSaleDto.shopName || '',
        items: items.map(({ categoryId, ...item }) => item),
        totalAmount: billAmount,
        discount,
        freight,
        paymentMode: createSaleDto.paymentMode,
        amountPaid,
        balanceDue,
        saleDate: createSaleDto.saleDate
          ? new Date(createSaleDto.saleDate)
          : new Date(),
        notes: createSaleDto.notes || '',
        createdBy: userId,
      });

      // Auto-link customer
      if (createSaleDto.customerName && createSaleDto.phone) {
        try {
          const customer = await this.customersService.findOrCreate(
            createSaleDto.customerName,
            createSaleDto.phone,
          );
          sale.customerId = customer._id;
        } catch (err) {
          this.logger.warn(`Failed to link customer: ${err?.message || err}`);
        }
      }

      // Auto-match dealer by shopName
      if (createSaleDto.shopName) {
        try {
          const dealer = await this.dealerModel
            .findOne({
              name: {
                $regex: `^${createSaleDto.shopName.trim()}$`,
                $options: 'i',
              },
            })
            .select('_id')
            .exec();
          if (dealer) {
            sale.dealerId = dealer._id;
          }
        } catch (err) {
          this.logger.warn(`Failed to match dealer: ${err?.message || err}`);
        }
      }

      // Two terminals can generate the same number between read and write, so
      // re-issue and retry instead of failing the bill. A number the caller
      // pinned explicitly is theirs to keep: that still surfaces as a conflict.
      let saved: SaleDocument;
      for (let attempt = 0; ; attempt++) {
        try {
          saved = await sale.save();
          break;
        } catch (err) {
          const isDuplicateSaleNumber =
            err?.code === 11000 && err?.keyPattern?.saleNumber;
          if (!isDuplicateSaleNumber || explicitSaleNumber || attempt >= 4) {
            throw err;
          }
          sale.saleNumber = await this.generateSaleNumber();
        }
      }

      this.customerLedgerService
        .onSaleCreated(saved)
        .catch((err) =>
          this.logger.warn(
            `Failed to record customer ledger for ${saved.saleNumber}: ${err?.message || err}`,
          ),
        );

      for (const item of items) {
        this.analyticsService
          .recordSale(
            item.productId.toString(),
            item.categoryId,
            item.quantity,
            item.subtotal,
          )
          .catch((err) =>
            this.logger.warn(
              `Failed to record sale analytics for ${item.productId}: ${err?.message || err}`,
            ),
          );
      }

      return saved;
    } catch (err) {
      for (const item of deductedItems.reverse()) {
        await this.shopProductsService.incrementStock(
          item.productId,
          item.quantity,
        );
      }
      throw err;
    }
  }

  async findAll(): Promise<SaleDocument[]> {
    return this.saleModel.find().sort({ saleDate: -1 }).exec();
  }

  async findOne(id: string): Promise<SaleDocument> {
    const sale = await this.saleModel.findById(id).exec();
    if (!sale) {
      throw new NotFoundException(`Sale with ID ${id} not found`);
    }
    return sale;
  }

  async update(
    id: string,
    updateSaleDto: any,
    userId?: string,
  ): Promise<SaleDocument> {
    const existingSale = await this.findOne(id);

    // 1. RESTORE old stock
    for (const item of existingSale.items) {
      await this.shopProductsService.incrementStock(
        item.productId.toString(),
        item.quantity,
      );
    }

    let totalAmount = 0;
    const items: any[] = [];
    const deductedItems: Array<{ productId: string; quantity: number }> = [];

    // Steps 2 and 3 both run after the restore above, so either failing leaves
    // stock inflated by this bill's old quantities. Guard them together.
    try {
      // 2. CONFIRM new items still exist — the restore is already applied.
      if (updateSaleDto.items && updateSaleDto.items.length > 0) {
        await this.assertProductsExist(updateSaleDto.items);
      }

      // 3. DEDUCT new stock and build items
      if (updateSaleDto.items && updateSaleDto.items.length > 0) {
        for (const item of updateSaleDto.items) {
          const linePrice = item.price;
          const lineSubtotal = linePrice * item.quantity;
          totalAmount += lineSubtotal;

          const updated = await this.shopProductsService.deductStock(
            item.productId,
            item.quantity,
          );
          deductedItems.push({
            productId: item.productId,
            quantity: item.quantity,
          });

          items.push({
            productId: new Types.ObjectId(item.productId),
            name: item.name || updated.name,
            sku: item.sku || updated.sku,
            quantity: item.quantity,
            price: linePrice,
            subtotal: lineSubtotal,
            categoryId: updated.shopCategoryId?.toString(),
          });
        }
      }
    } catch (err) {
      // Undo both halves before rethrowing: drop whatever this attempt took,
      // then re-apply the original bill that step 1 handed back.
      for (const done of deductedItems.reverse()) {
        await this.shopProductsService.incrementStock(
          done.productId,
          done.quantity,
        );
      }
      for (const original of existingSale.items) {
        // A plain decrement, not deductStock: this re-applies a deduction that
        // was already in effect a moment ago, so the availability guard must
        // not be allowed to refuse it.
        await this.shopProductsService.incrementStock(
          original.productId.toString(),
          -original.quantity,
        );
      }
      throw err;
    }

    const discount = updateSaleDto.discount || 0;
    const freight = updateSaleDto.freight || 0;
    const billAmount = Math.max(0, totalAmount + freight - discount);

    let amountPaid: number;
    if (
      updateSaleDto.amountPaid !== undefined &&
      updateSaleDto.amountPaid !== null
    ) {
      amountPaid = Number(updateSaleDto.amountPaid);
      if (isNaN(amountPaid) || amountPaid < 0) {
        throw new BadRequestException('amountPaid must be >= 0');
      }
      if (amountPaid > billAmount) amountPaid = billAmount;
    } else {
      amountPaid = updateSaleDto.paymentMode === 'credit' ? 0 : billAmount;
    }
    const balanceDue = Math.max(0, billAmount - amountPaid);

    // 4. UPDATE sale document
    const updatedSale = await this.saleModel
      .findByIdAndUpdate(
        id,
        {
          customerName: updateSaleDto.customerName || existingSale.customerName,
          phone: updateSaleDto.phone || existingSale.phone,
          shopName: updateSaleDto.shopName || existingSale.shopName,
          items: items.map(({ categoryId, ...item }) => item),
          totalAmount: billAmount,
          discount,
          freight,
          paymentMode: updateSaleDto.paymentMode || existingSale.paymentMode,
          amountPaid,
          balanceDue,
          saleDate: updateSaleDto.saleDate
            ? new Date(updateSaleDto.saleDate)
            : existingSale.saleDate,
          notes:
            updateSaleDto.notes !== undefined
              ? updateSaleDto.notes
              : existingSale.notes,
        },
        { new: true },
      )
      .exec();

    if (!updatedSale) {
      throw new NotFoundException(`Sale with ID ${id} not found`);
    }

    // 5. Update customer ledger
    await this.customerLedgerService
      .onSaleUpdated?.(updatedSale)
      .catch((err) =>
        this.logger.warn(
          `Failed to update customer ledger for ${updatedSale.saleNumber}: ${err?.message || err}`,
        ),
      );

    // 6. Update analytics for new items
    for (const item of items) {
      await this.analyticsService
        .recordSale(
          item.productId.toString(),
          item.categoryId,
          item.quantity,
          item.subtotal,
        )
        .catch((err) =>
          this.logger.warn(
            `Failed to record sale analytics for ${item.productId}: ${err?.message || err}`,
          ),
        );
    }

    return updatedSale;
  }

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const sale = await this.saleModel.findById(id).exec();
    if (!sale) {
      throw new NotFoundException(`Sale with ID ${id} not found`);
    }

    // Restore stock for each sold item
    for (const item of sale.items) {
      await this.shopProductsService.incrementStock(
        item.productId.toString(),
        item.quantity,
      );
    }

    await this.saleModel.findByIdAndDelete(id).exec();

    await this.customerLedgerService.onSaleRemoved(id);
    return { success: true, message: 'Sale deleted and stock restored' };
  }

  async getSummary() {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    const [todaySales, todayAgg, totals] = await Promise.all([
      this.saleModel
        .find({ saleDate: { $gte: startOfToday, $lte: endOfToday } })
        .exec(),
      this.saleModel
        .aggregate([
          {
            $match: { saleDate: { $gte: startOfToday, $lte: endOfToday } },
          },
          {
            $group: {
              _id: null,
              revenue: { $sum: '$totalAmount' },
            },
          },
        ])
        .exec(),
      this.saleModel
        .aggregate([
          {
            $group: {
              _id: null,
              totalSales: { $sum: 1 },
              totalRevenue: { $sum: '$totalAmount' },
            },
          },
        ])
        .exec(),
    ]);

    const todayRevenue = todayAgg.length > 0 ? todayAgg[0].revenue : 0;

    return {
      todaySalesCount: todaySales.length,
      todaySalesRevenue: todayRevenue,
      totalSales: totals.length > 0 ? totals[0].totalSales : 0,
      totalSalesRevenue: totals.length > 0 ? totals[0].totalRevenue : 0,
    };
  }

  async findByCustomer(
    customerId: string,
    query: {
      page?: number;
      limit?: number;
      from?: string;
      to?: string;
      search?: string;
      sort?: string;
    } = {},
  ): Promise<{
    items: SaleDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    if (!Types.ObjectId.isValid(customerId)) {
      throw new BadRequestException('Invalid customer ID');
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: any = { customerId: new Types.ObjectId(customerId) };

    if (query.from || query.to) {
      filter.saleDate = {};
      if (query.from) filter.saleDate.$gte = new Date(query.from);
      if (query.to) {
        const toDate = new Date(query.to);
        toDate.setHours(23, 59, 59, 999);
        filter.saleDate.$lte = toDate;
      }
    }

    if (query.search) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { saleNumber: regex },
        { customerName: regex },
        { phone: regex },
        { shopName: regex },
        { 'items.name': regex },
      ];
    }

    const sortField = query.sort || 'saleDate';
    const sortOrder = sortField.startsWith('-') ? -1 : 1;
    const sortKey = sortField.replace('-', '');
    const sort: any = { [sortKey]: sortOrder };

    const [items, total] = await Promise.all([
      this.saleModel.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.saleModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByDealer(
    dealerId: string,
    query: {
      page?: number;
      limit?: number;
      from?: string;
      to?: string;
      search?: string;
      sort?: string;
    } = {},
  ): Promise<{
    items: SaleDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    if (!Types.ObjectId.isValid(dealerId)) {
      throw new BadRequestException('Invalid dealer ID');
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: any = { dealerId: new Types.ObjectId(dealerId) };

    if (query.from || query.to) {
      filter.saleDate = {};
      if (query.from) filter.saleDate.$gte = new Date(query.from);
      if (query.to) {
        const toDate = new Date(query.to);
        toDate.setHours(23, 59, 59, 999);
        filter.saleDate.$lte = toDate;
      }
    }

    if (query.search) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { saleNumber: regex },
        { customerName: regex },
        { phone: regex },
        { shopName: regex },
        { 'items.name': regex },
      ];
    }

    const sortField = query.sort || 'saleDate';
    const sortOrder = sortField.startsWith('-') ? -1 : 1;
    const sortKey = sortField.replace('-', '');
    const sort: any = { [sortKey]: sortOrder };

    const [items, total] = await Promise.all([
      this.saleModel.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.saleModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
