import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { Sale, SaleDocument } from '../sales/schemas/sale.schema';
import {
  RawMaterial,
  RawMaterialDocument,
} from '../manufacturing/raw-materials/schemas/raw-material.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import {
  SemiFinishedStock,
  SemiFinishedStockDocument,
} from '../manufacturing/semi-finished-stock/schemas/semi-finished-stock.schema';
import {
  WorkBatch,
  WorkBatchDocument,
} from '../manufacturing/work-batches/schemas/work-batch.schema';
import {
  WorkerPayment,
  WorkerPaymentDocument,
} from '../manufacturing/worker-payments/schemas/worker-payment.schema';
import {
  Worker,
  WorkerDocument,
} from '../manufacturing/workers/schemas/worker.schema';
import { Dealer, DealerDocument } from '../dealers/schemas/dealer.schema';
import {
  DealerLedger,
  DealerLedgerDocument,
} from '../dealers/schemas/dealer-ledger.schema';
import {
  CustomerLedger,
  CustomerLedgerDocument,
} from '../customer-ledger/schemas/customer-ledger.schema';
import { ActivityService } from '../managers/activity.service';

export interface ReportDateRange {
  $gte?: Date;
  $lte?: Date;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectModel(Sale.name) private readonly saleModel: Model<SaleDocument>,
    @InjectModel(RawMaterial.name)
    private readonly rawMaterialModel: Model<RawMaterialDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(SemiFinishedStock.name)
    private readonly semiFinishedStockModel: Model<SemiFinishedStockDocument>,
    @InjectModel(WorkBatch.name)
    private readonly workBatchModel: Model<WorkBatchDocument>,
    @InjectModel(WorkerPayment.name)
    private readonly workerPaymentModel: Model<WorkerPaymentDocument>,
    @InjectModel(Worker.name)
    private readonly workerModel: Model<WorkerDocument>,
    @InjectModel(Dealer.name)
    private readonly dealerModel: Model<DealerDocument>,
    @InjectModel(DealerLedger.name)
    private readonly dealerLedgerModel: Model<DealerLedgerDocument>,
    @Optional()
    @InjectModel(CustomerLedger.name)
    private readonly customerLedgerModel?: Model<CustomerLedgerDocument>,
    @Optional() private readonly activityService?: ActivityService,
  ) {}

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------

  private parseDate(value?: string): Date | null {
    const trimmed = (value || '').trim();
    if (!trimmed) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  private startOfDay(value?: string): Date | null {
    const date = this.parseDate(value);
    if (!date) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private endOfDay(value?: string): Date | null {
    const date = this.parseDate(value);
    if (!date) return null;
    date.setHours(23, 59, 59, 999);
    return date;
  }

  private dateRange(from?: string, to?: string): ReportDateRange | null {
    const range: ReportDateRange = {};
    const start = this.startOfDay(from);
    const end = this.endOfDay(to);
    if (start) range.$gte = start;
    if (end) range.$lte = end;
    return Object.keys(range).length > 0 ? range : null;
  }

  private escapeRegex(input?: string): string {
    return (input || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private regexFilter(
    value?: string,
  ): { $regex: string; $options: string } | undefined {
    const safe = (value || '').trim();
    if (!safe) return undefined;
    return { $regex: this.escapeRegex(safe), $options: 'i' };
  }

  private onlyId(value?: string): Types.ObjectId | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    return isValidObjectId(trimmed) ? new Types.ObjectId(trimmed) : undefined;
  }

  private number(value: any, fallback = 0): number {
    const n = Number(value);
    return isNaN(n) ? fallback : n;
  }

  private sum(...values: any[]): number {
    return values.reduce((acc, v) => acc + this.number(v), 0);
  }

  // ---------------------------------------------------------------
  // Sales report
  // ---------------------------------------------------------------

  async salesReport(filters: {
    from?: string;
    to?: string;
    customer?: string;
    shop?: string;
    productId?: string;
    managerId?: string;
    groupBy?: string;
  }) {
    const { from, to, customer, shop, productId, managerId, groupBy } = filters;
    const query: any = {};
    const range = this.dateRange(from, to);
    if (range) query.saleDate = range;
    const customerFilter = this.regexFilter(customer);
    if (customerFilter) query.customerName = customerFilter;
    const shopFilter = this.regexFilter(shop);
    if (shopFilter) query.shopName = shopFilter;
    const productObjectId = this.onlyId(productId);
    if (productObjectId) query['items.productId'] = productObjectId;
    const managerObjectId = this.onlyId(managerId);
    if (managerObjectId) query.createdBy = managerObjectId;

    const rows = await this.saleModel
      .find(query)
      .sort({ saleDate: -1 })
      .lean()
      .exec();

    const [summaryAgg, byProduct, byCustomer, byDay] = await Promise.all([
      this.saleModel
        .aggregate([
          { $match: query },
          {
            $group: {
              _id: null,
              totalCount: { $sum: 1 },
              totalQty: {
                $sum: {
                  $reduce: {
                    input: { $ifNull: ['$items', []] },
                    initialValue: 0,
                    in: {
                      $add: ['$$value', { $ifNull: ['$$this.quantity', 0] }],
                    },
                  },
                },
              },
              totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
              totalDiscount: { $sum: { $ifNull: ['$discount', 0] } },
              totalFreight: { $sum: { $ifNull: ['$freight', 0] } },
              totalPaid: { $sum: { $ifNull: ['$amountPaid', 0] } },
              totalBalanceDue: { $sum: { $ifNull: ['$balanceDue', 0] } },
            },
          },
        ])
        .exec(),
      this.saleModel
        .aggregate([
          { $match: query },
          { $unwind: '$items' },
          {
            $group: {
              _id: '$items.productId',
              productId: { $first: '$items.productId' },
              name: { $first: '$items.name' },
              sku: { $first: { $ifNull: ['$items.sku', ''] } },
              quantity: { $sum: '$items.quantity' },
              amount: { $sum: { $ifNull: ['$items.subtotal', 0] } },
            },
          },
          { $sort: { amount: -1 } },
        ])
        .exec(),
      this.saleModel
        .aggregate([
          { $match: query },
          {
            $group: {
              _id: {
                customer: { $ifNull: ['$customerName', ''] },
                phone: { $ifNull: ['$phone', ''] },
              },
              salesCount: { $sum: 1 },
              totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
              totalPaid: { $sum: { $ifNull: ['$amountPaid', 0] } },
              balanceDue: { $sum: { $ifNull: ['$balanceDue', 0] } },
            },
          },
          { $sort: { balanceDue: -1 } },
        ])
        .exec(),
      groupBy === 'day'
        ? this.saleModel
            .aggregate([
              { $match: query },
              {
                $group: {
                  _id: {
                    $dateToString: { format: '%d/%m/%Y', date: '$saleDate' },
                  },
                  count: { $sum: 1 },
                  totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
                  totalDiscount: { $sum: { $ifNull: ['$discount', 0] } },
                  totalFreight: { $sum: { $ifNull: ['$freight', 0] } },
                  totalPaid: { $sum: { $ifNull: ['$amountPaid', 0] } },
                  balanceDue: { $sum: { $ifNull: ['$balanceDue', 0] } },
                },
              },
              { $sort: { _id: 1 } },
            ])
            .exec()
        : Promise.resolve([]),
    ]);

    const summary = summaryAgg[0] || {};
    return {
      summary: {
        totalCount: this.number(summary.totalCount),
        totalQty: this.number(summary.totalQty),
        totalAmount: this.number(summary.totalAmount),
        totalDiscount: this.number(summary.totalDiscount),
        totalFreight: this.number(summary.totalFreight),
        totalPaid: this.number(summary.totalPaid),
        totalBalanceDue: this.number(summary.totalBalanceDue),
      },
      rows,
      byProduct: byProduct.map((p: any) => ({
        productId: p.productId ? String(p.productId) : null,
        name: p.name || '',
        sku: p.sku || '',
        quantity: this.number(p.quantity),
        amount: this.number(p.amount),
      })),
      byCustomer: byCustomer.map((c: any) => ({
        customer: (c._id && c._id.customer) || '',
        phone: (c._id && c._id.phone) || '',
        salesCount: this.number(c.salesCount),
        totalAmount: this.number(c.totalAmount),
        totalPaid: this.number(c.totalPaid),
        balanceDue: this.number(c.balanceDue),
      })),
      byDay: byDay.map((d: any) => ({
        date: d._id,
        count: this.number(d.count),
        totalAmount: this.number(d.totalAmount),
        totalDiscount: this.number(d.totalDiscount),
        totalFreight: this.number(d.totalFreight),
        totalPaid: this.number(d.totalPaid),
        balanceDue: this.number(d.balanceDue),
      })),
    };
  }

  // ---------------------------------------------------------------
  // Purchases report
  // ---------------------------------------------------------------

  async purchasesReport(filters: {
    from?: string;
    to?: string;
    dealer?: string;
    material?: string;
  }) {
    const { from, to, dealer, material } = filters;
    const query: any = {};
    const range = this.dateRange(from, to);
    if (range) query.purchaseDate = range;
    const dealerFilter = this.regexFilter(dealer);
    if (dealerFilter) query.dealerName = dealerFilter;
    const materialFilter = this.regexFilter(material);
    if (materialFilter) query.materialName = materialFilter;

    const rows = await this.rawMaterialModel
      .find(query)
      .sort({ purchaseDate: -1 })
      .lean()
      .exec();

    const [summaryAgg, byDealer, byMaterial] = await Promise.all([
      this.rawMaterialModel
        .aggregate([
          { $match: query },
          {
            $group: {
              _id: null,
              totalItems: { $sum: 1 },
              totalQty: { $sum: { $ifNull: ['$quantity', 0] } },
              totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
            },
          },
        ])
        .exec(),
      this.rawMaterialModel
        .aggregate([
          { $match: query },
          {
            $group: {
              _id: { $ifNull: ['$dealerName', ''] },
              count: { $sum: 1 },
              qty: { $sum: { $ifNull: ['$quantity', 0] } },
              amount: { $sum: { $ifNull: ['$totalAmount', 0] } },
            },
          },
          { $sort: { amount: -1 } },
        ])
        .exec(),
      this.rawMaterialModel
        .aggregate([
          { $match: query },
          {
            $group: {
              _id: { $ifNull: ['$materialName', ''] },
              count: { $sum: 1 },
              qty: { $sum: { $ifNull: ['$quantity', 0] } },
              amount: { $sum: { $ifNull: ['$totalAmount', 0] } },
            },
          },
          { $sort: { amount: -1 } },
        ])
        .exec(),
    ]);

    const summary = summaryAgg[0] || {};
    return {
      summary: {
        totalItems: this.number(summary.totalItems),
        totalQty: this.number(summary.totalQty),
        totalAmount: this.number(summary.totalAmount),
      },
      rows,
      byDealer: byDealer.map((d: any) => ({
        dealer: d._id || '',
        count: this.number(d.count),
        qty: this.number(d.qty),
        amount: this.number(d.amount),
      })),
      byMaterial: byMaterial.map((m: any) => ({
        material: m._id || '',
        count: this.number(m.count),
        qty: this.number(m.qty),
        amount: this.number(m.amount),
      })),
    };
  }

  // ---------------------------------------------------------------
  // Inventory report
  // ---------------------------------------------------------------

  async inventoryReport(filters: {
    productId?: string;
    material?: string;
    category?: string;
  }) {
    const { productId, material, category } = filters;

    const productQuery: any = {};
    const productObjectId = this.onlyId(productId);
    if (productObjectId) productQuery._id = productObjectId;
    if (material) {
      const materialFilter = this.regexFilter(material);
      productQuery.$or = [
        { 'material.baseMetal': materialFilter },
        { 'material.plating': materialFilter },
      ];
    }
    if (category) {
      const categoryId = this.onlyId(category);
      if (categoryId) {
        productQuery.categoryId = categoryId;
      } else {
        const categoryFilter = this.regexFilter(category);
        productQuery.$or = [
          ...(productQuery.$or || []),
          { 'material.baseMetal': categoryFilter },
          { 'material.plating': categoryFilter },
        ];
      }
    }

    const [products, rawMaterials, semiFinished] = await Promise.all([
      this.productModel.find(productQuery).sort({ name: 1 }).lean().exec(),
      this.rawMaterialModel
        .find(material ? { materialName: this.regexFilter(material) } : {})
        .sort({ materialName: 1 })
        .lean()
        .exec(),
      this.semiFinishedStockModel.find({}).sort({ stage: 1 }).lean().exec(),
    ]);

    const productRows = products.map((p: any) => {
      const stock = this.number(p.stock);
      const stockStatus =
        stock <= 0 ? 'out_of_stock' : stock < 5 ? 'low_stock' : 'in_stock';
      return {
        _id: p._id,
        name: p.name || '',
        sku: p.sku || '',
        categoryId: p.categoryId ? String(p.categoryId) : null,
        price: this.number(p.price),
        stock,
        stockStatus,
        valuation:
          Math.round(Math.max(0, stock) * this.number(p.price) * 100) / 100,
      };
    });

    const materialRows = rawMaterials.map((r: any) => ({
      _id: r._id,
      materialName: r.materialName || '',
      dealerName: r.dealerName || '',
      quantity: this.number(r.quantity),
      pricePerKg: this.number(r.pricePerKg),
      purchaseDate: r.purchaseDate,
      valuation:
        Math.round(
          Math.max(0, this.number(r.quantity)) *
            this.number(r.pricePerKg) *
            100,
        ) / 100,
    }));

    const semiRows = semiFinished.map((s: any) => ({
      _id: s._id,
      stage: s.stage || '',
      quantity: this.number(s.quantity),
      status: s.status || 'ready',
    }));

    const totalValuation = this.sum(
      ...productRows.map((p: any) => p.valuation),
      ...materialRows.map((m: any) => m.valuation),
    );

    return {
      products: productRows,
      rawMaterials: materialRows,
      semiFinished: semiRows,
      summary: {
        productCount: productRows.length,
        materialCount: materialRows.length,
        semiFinishedCount: semiRows.length,
        negativeCount:
          productRows.filter((p: any) => p.stock < 0).length +
          materialRows.filter((m: any) => m.quantity < 0).length +
          semiRows.filter((s: any) => s.quantity < 0).length,
        totalValuation,
        lowStockCount: productRows.filter(
          (p: any) => p.stockStatus === 'low_stock',
        ).length,
        outOfStockCount: productRows.filter(
          (p: any) => p.stockStatus === 'out_of_stock',
        ).length,
      },
    };
  }

  // ---------------------------------------------------------------
  // Dealers report
  // ---------------------------------------------------------------

  async dealersReport(filters: {
    from?: string;
    to?: string;
    dealer?: string;
  }) {
    const { from, to, dealer } = filters;
    const dealerQuery: any = {};
    const dealerFilter = this.regexFilter(dealer);
    if (dealerFilter) dealerQuery.name = dealerFilter;

    const ledgerQuery: any = {};
    const range = this.dateRange(from, to);
    if (range) ledgerQuery.date = range;

    const [dealers, ledgerAgg, entries] = await Promise.all([
      this.dealerModel.find(dealerQuery).sort({ name: 1 }).lean().exec(),
      this.dealerLedgerModel
        .aggregate([
          { $match: ledgerQuery },
          {
            $group: {
              _id: '$dealerId',
              purchases: {
                $sum: {
                  $cond: [
                    { $eq: ['$type', 'purchase'] },
                    { $ifNull: ['$amount', 0] },
                    0,
                  ],
                },
              },
              payments: {
                $sum: {
                  $cond: [
                    { $eq: ['$type', 'payment'] },
                    { $ifNull: ['$amount', 0] },
                    0,
                  ],
                },
              },
            },
          },
        ])
        .exec(),
      this.dealerLedgerModel.find(ledgerQuery).sort({ date: -1 }).lean().exec(),
    ]);

    const allowedDealerIds = new Set(dealers.map((d: any) => String(d._id)));
    const ledgerByDealer = new Map(
      ledgerAgg.map((l: any) => [String(l._id), l]),
    );

    const entriesByDealer = new Map<string, any[]>();
    for (const entry of entries) {
      const key = String(entry.dealerId);
      if (allowedDealerIds.size > 0 && !allowedDealerIds.has(key)) continue;
      if (!entriesByDealer.has(key)) entriesByDealer.set(key, []);
      entriesByDealer.get(key)!.push({
        dealerId: key,
        date: entry.date,
        type: entry.type,
        amount: this.number(entry.amount),
        mode: entry.mode || '',
        notes: entry.notes || '',
      });
    }

    const rows = dealers.map((d: any) => {
      const ledger = ledgerByDealer.get(String(d._id)) || {};
      const totalPurchases = this.number(ledger.purchases);
      const totalPayments = this.number(ledger.payments);
      return {
        dealerId: d._id,
        name: d.name || '',
        phone: d.phone || '',
        totalPurchases,
        totalPayments,
        balanceDue: Math.max(0, totalPurchases - totalPayments),
        entries: entriesByDealer.get(String(d._id)) || [],
      };
    });

    return {
      summary: {
        dealerCount: rows.length,
        totalPurchases: this.sum(...rows.map((r: any) => r.totalPurchases)),
        totalPayments: this.sum(...rows.map((r: any) => r.totalPayments)),
        totalBalanceDue: this.sum(...rows.map((r: any) => r.balanceDue)),
      },
      rows,
    };
  }

  // ---------------------------------------------------------------
  // Customers report
  // ---------------------------------------------------------------
  // Prefers the CustomerLedger collection (grouped by customerName + phone
  // with sales/payments totals and balance due). Falls back to aggregating
  // Sale documents with an outstanding balance (balanceDue > 0) if the
  // ledger model is unavailable or empty.

  async customersReport(filters: {
    from?: string;
    to?: string;
    customer?: string;
  }) {
    if (this.customerLedgerModel) {
      try {
        const fromLedger = await this.customersReportFromLedger(filters);
        if (fromLedger.rows.length > 0) {
          return fromLedger;
        }
      } catch (err) {
        this.logger.warn(
          `CustomerLedger report failed, falling back to Sale aggregation: ${err?.message || err}`,
        );
      }
    }
    return this.customersReportFromSales(filters);
  }

  private async customersReportFromLedger(filters: {
    from?: string;
    to?: string;
    customer?: string;
  }) {
    const { from, to, customer } = filters;
    const match: any = {};
    const range = this.dateRange(from, to);
    if (range) match.date = range;
    const customerFilter = this.regexFilter(customer);
    if (customerFilter) match.customerName = customerFilter;

    const entries = await this.customerLedgerModel!.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            customer: { $ifNull: ['$customerName', ''] },
            phone: { $ifNull: ['$phone', ''] },
          },
          totalSales: {
            $sum: {
              $cond: [
                { $eq: ['$type', 'sale'] },
                { $ifNull: ['$amount', 0] },
                0,
              ],
            },
          },
          totalPaid: {
            $sum: {
              $cond: [
                { $eq: ['$type', 'payment'] },
                { $ifNull: ['$amount', 0] },
                0,
              ],
            },
          },
          lastActivity: { $max: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          customerName: '$_id.customer',
          phone: '$_id.phone',
          totalSales: 1,
          totalPaid: 1,
          balanceDue: { $subtract: ['$totalSales', '$totalPaid'] },
          lastActivity: 1,
        },
      },
      { $sort: { balanceDue: -1 } },
    ]).exec();

    const rows: any[] = entries.map((r: any) => ({
      customer: r.customerName || '',
      customerName: r.customerName || '',
      phone: r.phone || '',
      totalSales: this.number(r.totalSales),
      totalPaid: this.number(r.totalPaid),
      balanceDue: Math.max(0, this.number(r.balanceDue)),
      lastActivity: r.lastActivity || null,
    }));

    const ledgerEntries = await this.customerLedgerModel!.find(match)
      .sort({ customerName: 1, phone: 1, date: 1 })
      .lean()
      .exec();

    const entriesByCustomer = new Map<string, any[]>();
    for (const entry of ledgerEntries) {
      const key = `${entry.customerName || ''}__${entry.phone || ''}`;
      if (!entriesByCustomer.has(key)) entriesByCustomer.set(key, []);
      entriesByCustomer.get(key)!.push({
        customerName: entry.customerName || '',
        phone: entry.phone || '',
        date: entry.date,
        type: entry.type,
        amount: this.number(entry.amount),
        mode: entry.mode || '',
        notes: entry.notes || '',
        refSaleId: entry.refSaleId ? String(entry.refSaleId) : null,
      });
    }

    for (const row of rows) {
      row.entries =
        entriesByCustomer.get(`${row.customerName}__${row.phone}`) || [];
    }

    return {
      summary: {
        customerCount: rows.length,
        totalSales: this.sum(...rows.map((r: any) => r.totalSales)),
        totalPaid: this.sum(...rows.map((r: any) => r.totalPaid)),
        totalBalanceDue: this.sum(...rows.map((r: any) => r.balanceDue)),
      },
      rows,
    };
  }

  private async customersReportFromSales(filters: {
    from?: string;
    to?: string;
    customer?: string;
  }) {
    const { from, to, customer } = filters;
    const match: any = { balanceDue: { $gt: 0 } };
    const range = this.dateRange(from, to);
    if (range) match.saleDate = range;
    const customerFilter = this.regexFilter(customer);
    if (customerFilter) match.customerName = customerFilter;

    const agg = await this.saleModel
      .aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              customer: { $ifNull: ['$customerName', ''] },
              phone: { $ifNull: ['$phone', ''] },
            },
            salesCount: { $sum: 1 },
            totalQty: {
              $sum: {
                $reduce: {
                  input: { $ifNull: ['$items', []] },
                  initialValue: 0,
                  in: {
                    $add: ['$$value', { $ifNull: ['$$this.quantity', 0] }],
                  },
                },
              },
            },
            totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
            totalPaid: { $sum: { $ifNull: ['$amountPaid', 0] } },
            balanceDue: { $sum: { $ifNull: ['$balanceDue', 0] } },
          },
        },
        { $sort: { balanceDue: -1 } },
      ])
      .exec();

    const rows = agg.map((c: any) => ({
      customer: (c._id && c._id.customer) || '',
      customerName: (c._id && c._id.customer) || '',
      phone: (c._id && c._id.phone) || '',
      totalSales: this.number(c.salesCount),
      salesCount: this.number(c.salesCount),
      totalQty: this.number(c.totalQty),
      totalAmount: this.number(c.totalAmount),
      totalPaid: this.number(c.totalPaid),
      balanceDue: this.number(c.balanceDue),
      entries: [],
    }));

    return {
      summary: {
        customerCount: rows.length,
        totalSales: this.sum(...rows.map((r: any) => r.totalSales)),
        totalAmount: this.sum(...rows.map((r: any) => r.totalAmount)),
        totalPaid: this.sum(...rows.map((r: any) => r.totalPaid)),
        totalBalanceDue: this.sum(...rows.map((r: any) => r.balanceDue)),
      },
      rows,
    };
  }

  // ---------------------------------------------------------------
  // Workers report
  // ---------------------------------------------------------------

  async workersReport(filters: {
    from?: string;
    to?: string;
    worker?: string;
  }) {
    const { from, to, worker } = filters;
    const range = this.dateRange(from, to);
    const batchMatch: any = {};
    if (range) batchMatch.dateOut = range;
    const workerObjectId = this.onlyId(worker);
    if (workerObjectId) batchMatch.workerId = workerObjectId;

    const paymentMatch: any = {};
    if (range) paymentMatch.date = range;
    if (workerObjectId) paymentMatch.workerId = workerObjectId;

    const [batchAgg, batches, paymentAgg, payments] = await Promise.all([
      this.workBatchModel
        .aggregate([
          { $match: batchMatch },
          {
            $group: {
              _id: '$workerId',
              batches: { $sum: 1 },
              kgGiven: { $sum: { $ifNull: ['$kgGivenOut', 0] } },
              pcsGiven: { $sum: { $ifNull: ['$pcsGivenOut', 0] } },
              charge: { $sum: { $ifNull: ['$totalMakingCharge', 0] } },
            },
          },
        ])
        .exec(),
      this.workBatchModel.find(batchMatch).sort({ dateOut: 1 }).lean().exec(),
      this.workerPaymentModel
        .aggregate([
          { $match: paymentMatch },
          {
            $group: {
              _id: '$workerId',
              paid: { $sum: { $ifNull: ['$amountPaid', 0] } },
              advance: { $sum: { $ifNull: ['$advance', 0] } },
            },
          },
        ])
        .exec(),
      this.workerPaymentModel
        .find(paymentMatch)
        .sort({ date: 1 })
        .lean()
        .exec(),
    ]);

    const ids = Array.from(
      new Set<string>([
        ...batchAgg.map((b: any) => String(b._id)),
        ...paymentAgg.map((p: any) => String(p._id)),
      ]),
    ).filter(Boolean);

    let workerMap = new Map<string, any>();
    if (ids.length > 0) {
      const workers = await this.workerModel
        .find({ _id: { $in: ids } })
        .lean()
        .exec();
      workerMap = new Map(workers.map((w: any) => [String(w._id), w]));
    }

    const batchByWorker = new Map(batchAgg.map((b: any) => [String(b._id), b]));
    const paymentByWorker = new Map(
      paymentAgg.map((p: any) => [String(p._id), p]),
    );
    const entriesByWorker = new Map<string, any[]>();

    for (const batch of batches) {
      const id = String(batch.workerId);
      if (!entriesByWorker.has(id)) entriesByWorker.set(id, []);
      entriesByWorker.get(id)!.push({
        workerId: id,
        date: batch.dateIn || batch.dateOut,
        type: 'work',
        workType: batch.workType || '',
        kgGiven: this.number(batch.kgGivenOut),
        pcsReturned: this.number(batch.returnedPcs),
        defectivePcs: this.number(batch.defectCount),
        makingChargePerPcs: this.number(batch.makingChargePerPcs),
        amount: this.number(batch.totalMakingCharge),
        notes: batch.returnNotes || batch.assignNotes || '',
      });
    }

    for (const payment of payments) {
      const id = String(payment.workerId);
      if (!entriesByWorker.has(id)) entriesByWorker.set(id, []);
      entriesByWorker.get(id)!.push({
        workerId: id,
        date: payment.date,
        type: payment.advance > 0 ? 'advance' : 'payment',
        amount: this.number(payment.amountPaid || payment.advance),
        mode: payment.mode || '',
        notes: payment.remarks || '',
      });
    }

    const rows = ids.map((id) => {
      const batch = batchByWorker.get(id) || {};
      const payment = paymentByWorker.get(id) || {};
      const worker = workerMap.get(id) || {};
      const charge = this.number(batch.charge);
      const paid = this.number(payment.paid);
      const advance = this.number(payment.advance);
      return {
        workerId: id,
        name: worker.name || '',
        phone: worker.phone || '',
        type: worker.type || '',
        batches: this.number(batch.batches),
        kgGiven: this.number(batch.kgGiven),
        pcsGiven: this.number(batch.pcsGiven),
        charge,
        paid,
        advance,
        pending: Math.max(0, charge - paid - advance),
        entries: (entriesByWorker.get(id) || []).sort(
          (a: any, b: any) =>
            new Date(a.date).getTime() - new Date(b.date).getTime(),
        ),
      };
    });

    rows.sort((a: any, b: any) => b.charge - a.charge);

    return {
      summary: {
        totalWorkers: rows.length,
        totalBatches: this.sum(...rows.map((r: any) => r.batches)),
        totalKgGiven: this.sum(...rows.map((r: any) => r.kgGiven)),
        totalPcsGiven: this.sum(...rows.map((r: any) => r.pcsGiven)),
        totalMakingCharge: this.sum(...rows.map((r: any) => r.charge)),
        totalPaid: this.sum(...rows.map((r: any) => r.paid)),
        totalAdvance: this.sum(...rows.map((r: any) => r.advance)),
      },
      rows,
    };
  }

  // ---------------------------------------------------------------
  // Managers report
  // ---------------------------------------------------------------

  async managersReport(filters: {
    from?: string;
    to?: string;
    manager?: string;
  }) {
    const { from, to, manager } = filters;
    const startDate = this.startOfDay(from) || new Date(0);
    const endDate = this.endOfDay(to) || new Date();

    const match: any = {};
    const range = this.dateRange(from, to);
    if (range) match.saleDate = range;
    const managerObjectId = this.onlyId(manager);
    if (managerObjectId) match.createdBy = managerObjectId;

    let rows: any[] = [];
    try {
      const agg = await this.saleModel
        .aggregate([
          { $match: match },
          {
            $group: {
              _id: '$createdBy',
              salesCount: { $sum: 1 },
              totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
              totalPaid: { $sum: { $ifNull: ['$amountPaid', 0] } },
              balanceDue: { $sum: { $ifNull: ['$balanceDue', 0] } },
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'user',
            },
          },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        ])
        .exec();

      rows = agg.map((r: any) => {
        const name =
          r.user && (r.user.firstname || r.user.lastname)
            ? [r.user.firstname || '', r.user.lastname || ''].join(' ').trim()
            : '';
        return {
          managerId: r._id ? String(r._id) : null,
          name,
          salesCount: this.number(r.salesCount),
          totalAmount: this.number(r.totalAmount),
          totalPaid: this.number(r.totalPaid),
          balanceDue: this.number(r.balanceDue),
        };
      });
      rows.sort((a: any, b: any) => b.totalAmount - a.totalAmount);
    } catch (err) {
      this.logger.warn(
        `Managers sales aggregation failed (createdBy field may not exist yet): ${err?.message || err}`,
      );
    }

    let activity: any = null;
    try {
      if (this.activityService) {
        activity = managerObjectId
          ? await this.activityService.getManagerReport(
              managerObjectId.toString(),
              startDate,
              endDate,
            )
          : await this.activityService.getAllManagersReport(
              startDate,
              endDate,
              manager,
            );
      }
    } catch (err) {
      this.logger.warn(
        `Managers activity report failed: ${err?.message || err}`,
      );
      activity = null;
    }

    return {
      summary: {
        managerCount: rows.length,
        salesCount: this.sum(...rows.map((r: any) => r.salesCount)),
        totalAmount: this.sum(...rows.map((r: any) => r.totalAmount)),
        totalPaid: this.sum(...rows.map((r: any) => r.totalPaid)),
        totalBalanceDue: this.sum(...rows.map((r: any) => r.balanceDue)),
      },
      rows,
      activity,
    };
  }
}
