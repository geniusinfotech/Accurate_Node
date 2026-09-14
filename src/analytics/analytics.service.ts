import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  InventorySalesAnalytics,
  InventorySalesAnalyticsDocument,
} from './schemas/inventory-sales-analytics.schema';
import { ShopProductsService } from '../shop-products/services/shop-products.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectModel(InventorySalesAnalytics.name)
    private analyticsModel: Model<InventorySalesAnalyticsDocument>,
    private shopProductsService: ShopProductsService,
  ) {}

  async recordSale(
    productId: string | Types.ObjectId,
    categoryId: string | Types.ObjectId,
    quantity: number,
    revenue: number,
  ) {
    try {
      // Convert ObjectId instances to strings if needed
      const productIdStr =
        typeof productId === 'string' ? productId : productId.toString();
      const categoryIdStr =
        typeof categoryId === 'string' ? categoryId : categoryId.toString();

      // Validate ObjectId format
      if (!Types.ObjectId.isValid(productIdStr)) {
        this.logger.error(
          `Invalid productId format in recordSale: ${productIdStr} (type: ${typeof productId})`,
        );
        return null;
      }
      if (!Types.ObjectId.isValid(categoryIdStr)) {
        this.logger.error(
          `Invalid categoryId format in recordSale: ${categoryIdStr} (type: ${typeof categoryId})`,
        );
        return null;
      }

      const sale = new this.analyticsModel({
        productId: new Types.ObjectId(productIdStr),
        categoryId: new Types.ObjectId(categoryIdStr),
        date: new Date(),
        quantitySold: quantity,
        revenue: revenue,
      });
      return sale.save();
    } catch (error) {
      this.logger.error(`Error recording sale: ${error.message}`, error.stack);
      return null;
    }
  }

  async getProductForecast(productId: string, forecastDays: number = 30) {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const stats = await this.analyticsModel.aggregate([
      {
        $match: {
          productId: new Types.ObjectId(productId),
          date: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: '$productId',
          totalSold: { $sum: '$quantitySold' },
        },
      },
    ]);

    const totalSold = stats.length > 0 ? stats[0].totalSold : 0;
    const avgDailySales = totalSold / 30;
    const expectedDemand = Math.ceil(avgDailySales * forecastDays);
    const recommendedStock = Math.ceil(expectedDemand * 1.2); // 20% buffer

    return {
      productId,
      avgDailySales: parseFloat(avgDailySales.toFixed(2)),
      expectedDemand,
      recommendedStock,
    };
  }

  async getCategoryForecast(categoryId: string) {
    const stats = await this.analyticsModel.aggregate([
      {
        $match: {
          categoryId: new Types.ObjectId(categoryId),
          date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: '$categoryId',
          totalSold: { $sum: '$quantitySold' },
          totalRevenue: { $sum: '$revenue' },
        },
      },
    ]);

    return stats.length > 0 ? stats[0] : { totalSold: 0, totalRevenue: 0 };
  }

  async getStockOutRisk() {
    // This is complex. We need velocity for all products.
    // Simplified: Look at all products with stock < 20 and calculate days left.
    const products = await this.shopProductsService.findAllShopProducts();
    const riskReport: {
      productId: any;
      name: string;
      daysLeft: number;
      riskLevel: string;
    }[] = [];

    for (const prod of products) {
      if (prod.stock < 20) {
        // Cast to any to access _id if the Product type definition is missing it
        const productId = (prod as any)._id;
        const forecast = await this.getProductForecast(
          productId.toString(),
          30,
        );
        if (forecast.avgDailySales > 0) {
          const daysLeft = Math.floor(prod.stock / forecast.avgDailySales);
          if (daysLeft < 7) {
            riskReport.push({
              productId: productId,
              name: prod.name,
              daysLeft,
              riskLevel: daysLeft < 3 ? 'CRITICAL' : 'HIGH',
            });
          }
        }
      }
    }

    return riskReport.sort((a, b) => a.daysLeft - b.daysLeft);
  }

  async getInventorySummary() {
    const totalProducts = await this.shopProductsService
      .findAllShopProducts()
      .then((products) => products.length);
    const lowStockCount = await this.shopProductsService
      .findAllShopProducts()
      .then((products) => products.filter((p) => p.stock < 5).length);
    const outOfStockCount = await this.shopProductsService
      .findAllShopProducts()
      .then((products) => products.filter((p) => p.stock === 0).length);

    return {
      totalProducts,
      lowStockCount,
      outOfStockCount,
    };
  }

  // Sales are recorded by the counter POS, which sells shop products, so every
  // join here resolves against the shop catalogue — not the website one.
  async getTopSelling(limit: number = 10) {
    return this.analyticsModel.aggregate([
      {
        $group: {
          _id: '$productId',
          totalQuantity: { $sum: '$quantitySold' },
          totalRevenue: { $sum: '$revenue' },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'shop_products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $project: {
          productId: '$_id',
          name: '$product.name',
          stock: '$product.stock',
          totalQuantity: 1,
          totalRevenue: 1,
        },
      },
    ]);
  }

  async getSlowMoving(days: number = 60) {
    // Find products with no sales in the last X days
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    const activeProductIds = await this.analyticsModel.distinct('productId', {
      date: { $gte: dateLimit },
    });

    const allProducts = await this.shopProductsService.findAllShopProducts();

    // Filter products that are NOT in activeProductIds and have stock > 0
    const slowMoving = allProducts.filter(
      (p) =>
        !activeProductIds.find(
          (id) => id.toString() === (p as any)._id.toString(),
        ) && p.stock > 0,
    );

    return slowMoving.map((p) => ({
      productId: (p as any)._id,
      name: p.name,
      stock: p.stock,
      lastSale: 'No sales in last ' + days + ' days',
    }));
  }
}
