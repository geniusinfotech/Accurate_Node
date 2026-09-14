import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  WorkBatch,
  WorkBatchDocument,
} from '../manufacturing/work-batches/schemas/work-batch.schema';
import {
  RawMaterial,
  RawMaterialDocument,
} from '../manufacturing/raw-materials/schemas/raw-material.schema';
import { WorkerPaymentsService } from '../manufacturing/worker-payments/worker-payments.service';
import { DealersService } from '../dealers/dealers.service';
import { SalesService } from '../sales/sales.service';
import { OrdersService } from '../orders/orders.service';
import { CustomerLedgerService } from '../customer-ledger/customer-ledger.service';

const LOW_STOCK_THRESHOLD_KG = 10;

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(WorkBatch.name)
    private workBatchModel: Model<WorkBatchDocument>,
    @InjectModel(RawMaterial.name)
    private rawMaterialModel: Model<RawMaterialDocument>,
    private readonly workerPaymentsService: WorkerPaymentsService,
    private readonly dealersService: DealersService,
    private readonly salesService: SalesService,
    private readonly ordersService: OrdersService,
    private readonly customerLedgerService: CustomerLedgerService,
  ) {}

  async getSummary() {
    // 1. Pending work batches (status: out | partial)
    const pendingWorkBatchesCount = await this.workBatchModel.countDocuments({
      status: { $in: ['out', 'partial'] },
    });

    // 2. Low raw-material stock — RawMaterial only has `quantity`, no per-material
    // minimum threshold field, so compare against a shared constant
    const lowRawMaterialStock = await this.rawMaterialModel
      .find({ quantity: { $lte: LOW_STOCK_THRESHOLD_KG } })
      .exec();

    // 3. Total dues to workers — getLedgerSummary() returns `netPending`, not `balance`.
    //    `workerDues` uses duePending = (totalDue − totalPaid) only (excludes advance/deduction).
    const workerLedgerSummary =
      await this.workerPaymentsService.getLedgerSummary();
    const totalWorkerDues = workerLedgerSummary.reduce(
      (acc, curr) => acc + (curr.duePending || 0),
      0,
    );
    const totalWorkerAdvances = workerLedgerSummary.reduce(
      (acc, curr) => acc + (curr.totalAdvance || 0),
      0,
    );

    // 4. Total dues to dealers — getLedgerSummary() returns `balanceDue`, not `runningBalance`
    const dealerLedgerSummary = await this.dealersService.getLedgerSummary();
    const totalDealerDues = dealerLedgerSummary.reduce(
      (acc, curr) => acc + (curr.balanceDue || 0),
      0,
    );

    // 5. This-month production count (work batches created or completed this month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const thisMonthProductionCount = await this.workBatchModel.countDocuments({
      createdAt: { $gte: startOfMonth, $lte: endOfMonth },
    });

    // 6. Sales metrics for POS + Web
    const salesSummary = await this.salesService.getSummary();
    const webOrdersSummary = await this.ordersService.getSummary();

    // 7. Total dues from customers — sum of positive balances only, so a
    // customer who has overpaid does not offset what others still owe.
    const customerLedgerSummary = await this.customerLedgerService.getSummary();
    const totalCustomerDues = customerLedgerSummary.reduce(
      (acc, curr) => acc + Math.max(0, curr.balanceDue || 0),
      0,
    );

    return {
      // Names matching app/admin/page.tsx's primary lookups
      pendingWorkCount: pendingWorkBatchesCount,
      lowStockAlerts: lowRawMaterialStock.length,
      workerDues: totalWorkerDues,
      workerAdvances: totalWorkerAdvances,
      dealerDues: totalDealerDues,
      customerDues: totalCustomerDues,
      thisMonthProduction: thisMonthProductionCount,
      todaySalesCount: salesSummary.todaySalesCount,
      todaySalesRevenue: salesSummary.todaySalesRevenue,
      totalSales: salesSummary.totalSales,
      totalSalesRevenue: salesSummary.totalSalesRevenue,

      // Online Web Sales metrics
      totalWebOrdersCount: webOrdersSummary.totalOrdersCount,
      totalWebRevenue: webOrdersSummary.totalWebRevenue,
      pendingShipmentCount: webOrdersSummary.pendingShipmentCount,
      todayWebOrdersCount: webOrdersSummary.todayOrdersCount,
      todayWebRevenue: webOrdersSummary.todayRevenue,
      webPlacedCount: webOrdersSummary.placedCount,
      webProcessingCount: webOrdersSummary.processingCount,
      webShippedCount: webOrdersSummary.shippedCount,
      webDeliveredCount: webOrdersSummary.deliveredCount,

      // Kept for anything else that might read the old/verbose names
      pendingWorkBatchesCount,
      lowRawMaterialStockCount: lowRawMaterialStock.length,
      lowRawMaterialStock,
      totalWorkerDues,
      totalWorkerAdvances,
      totalDealerDues,
      totalCustomerDues,
      thisMonthProductionCount,
      workerLedgerSummary,
      dealerLedgerSummary,
    };
  }
}
