import { Types } from 'mongoose';
import { ReportsService } from './reports.service';

type ModelMock = {
  find: jest.Mock;
  aggregate: jest.Mock;
};

const chainResult = (result: any) => ({
  sort: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(result),
});

const aggregateResult = (result: any) => ({
  exec: jest.fn().mockResolvedValue(result),
});

const createModelMock = ({
  findResults = [],
  aggregateResults = [],
}: {
  findResults?: any[];
  aggregateResults?: any[];
} = {}): ModelMock => {
  let findIndex = 0;
  let aggregateIndex = 0;

  return {
    find: jest.fn(() => chainResult(findResults[findIndex++] ?? [])),
    aggregate: jest.fn(() =>
      aggregateResult(aggregateResults[aggregateIndex++] ?? []),
    ),
  };
};

const createService = (overrides: Partial<Record<string, any>> = {}) => {
  const models = {
    saleModel: createModelMock(),
    rawMaterialModel: createModelMock(),
    productModel: createModelMock(),
    semiFinishedStockModel: createModelMock(),
    workBatchModel: createModelMock(),
    workerPaymentModel: createModelMock(),
    workerModel: createModelMock(),
    dealerModel: createModelMock(),
    dealerLedgerModel: createModelMock(),
    customerLedgerModel: createModelMock(),
    ...overrides,
  };

  const service = new ReportsService(
    models.saleModel as any,
    models.rawMaterialModel as any,
    models.productModel as any,
    models.semiFinishedStockModel as any,
    models.workBatchModel as any,
    models.workerPaymentModel as any,
    models.workerModel as any,
    models.dealerModel as any,
    models.dealerLedgerModel as any,
    models.customerLedgerModel as any,
  );

  return { service, models };
};

describe('ReportsService QA datasets', () => {
  it('creates a sales report from multiple sales, products, customers, and days', async () => {
    const productId = new Types.ObjectId();
    const managerId = new Types.ObjectId();
    const rows = [
      {
        saleNumber: 'S-002',
        customerName: 'Neha Shah',
        saleDate: new Date('2026-09-11T12:00:00.000Z'),
        totalAmount: 2500,
      },
      {
        saleNumber: 'S-001',
        customerName: 'Anika Rao',
        saleDate: new Date('2026-09-10T12:00:00.000Z'),
        totalAmount: 1800,
      },
    ];
    const saleModel = createModelMock({
      findResults: [rows],
      aggregateResults: [
        [
          {
            totalCount: 2,
            totalQty: 7,
            totalAmount: 4300,
            totalDiscount: 200,
            totalFreight: 80,
            totalPaid: 3500,
            totalBalanceDue: 800,
          },
        ],
        [
          {
            productId,
            name: 'Kundan Necklace',
            sku: 'NEC-001',
            quantity: 4,
            amount: 2800,
          },
          {
            productId: null,
            name: 'Bangle Set',
            sku: 'BAN-002',
            quantity: 3,
            amount: 1500,
          },
        ],
        [
          {
            _id: { customer: 'Neha Shah', phone: '9999999999' },
            salesCount: 1,
            totalAmount: 2500,
            totalPaid: 1700,
            balanceDue: 800,
          },
        ],
        [
          {
            _id: '10/09/2026',
            count: 1,
            totalAmount: 1800,
            totalDiscount: 50,
            totalFreight: 30,
            totalPaid: 1800,
            balanceDue: 0,
          },
          {
            _id: '11/09/2026',
            count: 1,
            totalAmount: 2500,
            totalDiscount: 150,
            totalFreight: 50,
            totalPaid: 1700,
            balanceDue: 800,
          },
        ],
      ],
    });
    const { service } = createService({ saleModel });

    const report = await service.salesReport({
      from: '2026-09-10',
      to: '2026-09-11',
      customer: 'Neha',
      shop: 'Main',
      productId: productId.toString(),
      managerId: managerId.toString(),
      groupBy: 'day',
    });

    expect(saleModel.find).toHaveBeenCalledWith({
      saleDate: {
        $gte: new Date(2026, 8, 10, 0, 0, 0, 0),
        $lte: new Date(2026, 8, 11, 23, 59, 59, 999),
      },
      customerName: { $regex: 'Neha', $options: 'i' },
      shopName: { $regex: 'Main', $options: 'i' },
      'items.productId': productId,
      createdBy: managerId,
    });
    expect(report.summary).toEqual({
      totalCount: 2,
      totalQty: 7,
      totalAmount: 4300,
      totalDiscount: 200,
      totalFreight: 80,
      totalPaid: 3500,
      totalBalanceDue: 800,
    });
    expect(report.byProduct).toEqual([
      {
        productId: productId.toString(),
        name: 'Kundan Necklace',
        sku: 'NEC-001',
        quantity: 4,
        amount: 2800,
      },
      {
        productId: null,
        name: 'Bangle Set',
        sku: 'BAN-002',
        quantity: 3,
        amount: 1500,
      },
    ]);
    expect(report.byDay).toHaveLength(2);
    expect(report.rows).toBe(rows);
  });

  it('calculates inventory valuations and stock alerts across products, materials, and semi-finished stock', async () => {
    const productModel = createModelMock({
      findResults: [
        [
          {
            _id: 'p1',
            name: 'Temple Necklace',
            sku: 'TMP-001',
            categoryId: new Types.ObjectId(),
            price: 1200,
            stock: 4,
          },
          {
            _id: 'p2',
            name: 'Pearl Earrings',
            sku: 'PER-002',
            price: 800,
            stock: 0,
          },
          {
            _id: 'p3',
            name: 'Damaged Test Stock',
            sku: 'DMG-003',
            price: 500,
            stock: -2,
          },
        ],
      ],
    });
    const rawMaterialModel = createModelMock({
      findResults: [
        [
          {
            _id: 'r1',
            materialName: 'Brass Wire',
            dealerName: 'Metal House',
            quantity: 10,
            pricePerKg: 450,
          },
          {
            _id: 'r2',
            materialName: 'Copper Beads',
            dealerName: 'Metal House',
            quantity: -1,
            pricePerKg: 300,
          },
        ],
      ],
    });
    const semiFinishedStockModel = createModelMock({
      findResults: [
        [
          { _id: 's1', stage: 'chain', quantity: 5, status: 'ready' },
          { _id: 's2', stage: 'polish', quantity: -3, status: 'processing' },
        ],
      ],
    });
    const { service } = createService({
      productModel,
      rawMaterialModel,
      semiFinishedStockModel,
    });

    const report = await service.inventoryReport({ material: 'Brass' });

    expect(productModel.find).toHaveBeenCalledWith({
      $or: [
        { 'material.baseMetal': { $regex: 'Brass', $options: 'i' } },
        { 'material.plating': { $regex: 'Brass', $options: 'i' } },
      ],
    });
    expect(report.summary).toEqual({
      productCount: 3,
      materialCount: 2,
      semiFinishedCount: 2,
      negativeCount: 3,
      totalValuation: 9300,
      lowStockCount: 1,
      outOfStockCount: 2,
    });
    expect(report.products.map((p: any) => p.stockStatus)).toEqual([
      'low_stock',
      'out_of_stock',
      'out_of_stock',
    ]);
  });

  it('uses customer ledger data before falling back to sales balances', async () => {
    const customerLedgerModel = createModelMock({
      findResults: [
        [
          {
            customerName: 'Anika Rao',
            phone: '8888888888',
            date: new Date('2026-09-10T12:00:00.000Z'),
            type: 'sale',
            amount: 2000,
            refSaleId: new Types.ObjectId(),
          },
          {
            customerName: 'Anika Rao',
            phone: '8888888888',
            date: new Date('2026-09-11T12:00:00.000Z'),
            type: 'payment',
            amount: 500,
            mode: 'upi',
          },
        ],
      ],
      aggregateResults: [
        [
          {
            customerName: 'Anika Rao',
            phone: '8888888888',
            totalSales: 2000,
            totalPaid: 500,
            balanceDue: 1500,
            lastActivity: new Date('2026-09-11T12:00:00.000Z'),
          },
        ],
      ],
    });
    const { service } = createService({ customerLedgerModel });

    const report = await service.customersReport({ customer: 'Anika' });

    expect(report.summary).toEqual({
      customerCount: 1,
      totalSales: 2000,
      totalPaid: 500,
      totalBalanceDue: 1500,
    });
    expect(report.rows[0].entries).toHaveLength(2);
  });

  it('falls back to sales balances when the customer ledger is empty', async () => {
    const saleModel = createModelMock({
      aggregateResults: [
        [
          {
            _id: { customer: 'Credit Customer', phone: '7777777777' },
            salesCount: 2,
            totalQty: 6,
            totalAmount: 3000,
            totalPaid: 1000,
            balanceDue: 2000,
          },
        ],
      ],
    });
    const customerLedgerModel = createModelMock({ aggregateResults: [[]] });
    const { service } = createService({ saleModel, customerLedgerModel });

    const report = await service.customersReport({ from: '2026-09-01' });

    expect(report.summary.totalBalanceDue).toBe(2000);
    expect(report.rows[0]).toMatchObject({
      customer: 'Credit Customer',
      salesCount: 2,
      totalQty: 6,
      totalAmount: 3000,
      totalPaid: 1000,
      balanceDue: 2000,
    });
  });

  it('combines worker batch and payment rows into pending dues', async () => {
    const workerId = new Types.ObjectId();
    const workBatchModel = createModelMock({
      findResults: [
        [
          {
            workerId,
            dateOut: new Date('2026-09-09T12:00:00.000Z'),
            workType: 'Chain',
            kgGivenOut: 2,
            pcsGivenOut: 0,
            returnedPcs: 0,
            defectCount: 1,
            makingChargePerPcs: 0,
            totalMakingCharge: 1200,
          },
        ],
      ],
      aggregateResults: [
        [
          {
            _id: workerId,
            batches: 1,
            kgGiven: 2,
            pcsGiven: 0,
            charge: 1200,
          },
        ],
      ],
    });
    const workerPaymentModel = createModelMock({
      findResults: [
        [
          {
            workerId,
            date: new Date('2026-09-10T12:00:00.000Z'),
            amountPaid: 400,
            advance: 100,
            mode: 'cash',
            remarks: 'QA partial',
          },
        ],
      ],
      aggregateResults: [[{ _id: workerId, paid: 400, advance: 100 }]],
    });
    const workerModel = createModelMock({
      findResults: [
        [
          {
            _id: workerId,
            name: 'KGS Worker',
            phone: '6666666666',
            type: 'chain',
          },
        ],
      ],
    });
    const { service } = createService({
      workBatchModel,
      workerPaymentModel,
      workerModel,
    });

    const report = await service.workersReport({ worker: workerId.toString() });

    expect(report.summary).toEqual({
      totalWorkers: 1,
      totalBatches: 1,
      totalKgGiven: 2,
      totalPcsGiven: 0,
      totalMakingCharge: 1200,
      totalPaid: 400,
      totalAdvance: 100,
    });
    expect(report.rows[0]).toMatchObject({
      workerId: workerId.toString(),
      name: 'KGS Worker',
      charge: 1200,
      paid: 400,
      advance: 100,
      pending: 700,
    });
    expect(report.rows[0].entries.map((entry: any) => entry.type)).toEqual([
      'work',
      'advance',
    ]);
  });

  it('keeps manager reports available when sales lookup aggregation fails', async () => {
    const saleModel = {
      find: jest.fn(),
      aggregate: jest.fn(() => ({
        exec: jest.fn().mockRejectedValue(new Error('lookup failed')),
      })),
    };
    const activity = {
      activeManagers: 2,
      totalActions: 9,
    };
    const activityService = {
      getAllManagersReport: jest.fn().mockResolvedValue(activity),
      getManagerReport: jest.fn(),
    };
    const models = {
      saleModel,
      rawMaterialModel: createModelMock(),
      productModel: createModelMock(),
      semiFinishedStockModel: createModelMock(),
      workBatchModel: createModelMock(),
      workerPaymentModel: createModelMock(),
      workerModel: createModelMock(),
      dealerModel: createModelMock(),
      dealerLedgerModel: createModelMock(),
      customerLedgerModel: createModelMock(),
    };
    const service = new ReportsService(
      models.saleModel as any,
      models.rawMaterialModel as any,
      models.productModel as any,
      models.semiFinishedStockModel as any,
      models.workBatchModel as any,
      models.workerPaymentModel as any,
      models.workerModel as any,
      models.dealerModel as any,
      models.dealerLedgerModel as any,
      models.customerLedgerModel as any,
      activityService as any,
    );

    const report = await service.managersReport({
      from: '2026-09-01',
      to: '2026-09-12',
    });

    expect(report.summary).toEqual({
      managerCount: 0,
      salesCount: 0,
      totalAmount: 0,
      totalPaid: 0,
      totalBalanceDue: 0,
    });
    expect(report.activity).toBe(activity);
  });
});
