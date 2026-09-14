import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { EventEmitter2 as NestEventEmitter } from '@nestjs/event-emitter';
import { RedisCacheService } from '../common/cache/cache.service';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private eventEmitter: NestEventEmitter,
    private cache: RedisCacheService,
  ) {}

  /**
   * Reserve stock when an order is created.
   * reservedStock += quantity
   */
  async reserveStock(productId: string, quantity: number) {
    const product = await this.productModel.findById(productId);
    if (!product) throw new BadRequestException('Product not found');

    const available = product.stock - product.reservedStock;
    if (available < quantity) {
      throw new BadRequestException(
        `Insufficient stock for product ${product.name}. Available: ${available}`,
      );
    }

    const updated = await this.productModel.findByIdAndUpdate(
      productId,
      { $inc: { reservedStock: quantity } },
      { new: true },
    );

    if (updated) {
      this.emitUpdate(updated);
    }

    await this.cache.delByPrefix('products:');
    return updated;
  }

  /**
   * Atomically decrement stock on payment success.
   * totalStock -= quantity
   * reservedStock -= quantity
   */
  async confirmStock(productId: string, quantity: number) {
    const updated = await this.productModel.findByIdAndUpdate(
      productId,
      { $inc: { stock: -quantity, reservedStock: -quantity } },
      { new: true },
    );

    if (!updated) {
      this.logger.warn(
        `Product ${productId} not found during stock confirmation. Skipping stock update.`,
      );
      return null;
    }

    this.emitUpdate(updated);

    if (updated.stock <= 0) {
      this.eventEmitter.emit('inventory.outOfStock', {
        productId: updated._id,
        categoryId: updated.categoryId,
        availableStock: 0,
        updatedAt: new Date(),
      });
    } else if (updated.stock < 5) {
      // Threshold for low stock
      this.eventEmitter.emit('inventory.lowStock', {
        productId: updated._id,
        categoryId: updated.categoryId,
        availableStock: updated.stock - updated.reservedStock,
        updatedAt: new Date(),
      });
    }

    await this.cache.delByPrefix('products:');
    return updated;
  }

  /**
   * Release reserved stock if order is cancelled or failed.
   * reservedStock -= quantity
   */
  async releaseStock(productId: string, quantity: number) {
    const updated = await this.productModel.findByIdAndUpdate(
      productId,
      { $inc: { reservedStock: -quantity } },
      { new: true },
    );

    if (!updated) {
      this.logger.warn(
        `Product ${productId} not found during stock release. Skipping stock update.`,
      );
      return null;
    }

    this.emitUpdate(updated);
    await this.cache.delByPrefix('products:');
    return updated;
  }

  private emitUpdate(product: ProductDocument) {
    this.eventEmitter.emit('inventory.updated', {
      productId: product._id,
      availableStock: product.stock - product.reservedStock,
      categoryId: product.categoryId,
      updatedAt: new Date(),
    });
  }

  /**
   * Atomically deduct stock for an offline / direct sale.
   * Stock is allowed to go negative (credit sales may oversell).
   */
  async deductStock(productId: string, quantity: number) {
    const product = await this.productModel
      .findOneAndUpdate(
        { _id: productId },
        { $inc: { stock: -quantity } },
        { new: true },
      )
      .exec();

    if (!product) {
      throw new BadRequestException('Product not found');
    }

    if (product.stock <= 0) {
      await this.productModel
        .findByIdAndUpdate(
          productId,
          { stockStatus: 'out_of_stock' },
          { new: true },
        )
        .exec();
      product.stockStatus = 'out_of_stock';

      this.eventEmitter.emit('inventory.outOfStock', {
        productId: product._id,
        categoryId: product.categoryId,
        availableStock: 0,
        updatedAt: new Date(),
      });
    } else if (product.stock < 5) {
      this.eventEmitter.emit('inventory.lowStock', {
        productId: product._id,
        categoryId: product.categoryId,
        availableStock: product.stock - product.reservedStock,
        updatedAt: new Date(),
      });
    }

    this.emitUpdate(product);
    await this.cache.delByPrefix('products:');
    return product;
  }

  /**
   * Atomically increment stock (e.g. when a sale is reversed/deleted).
   */
  async incrementStock(productId: string, quantity: number) {
    const updated = await this.productModel.findOneAndUpdate(
      { _id: productId },
      { $inc: { stock: quantity } },
      { new: true },
    );
    if (updated) {
      this.emitUpdate(updated);
    }
    await this.cache.delByPrefix('products:');
    return updated;
  }

  /**
   * Direct stock adjustment (e.g. from Admin manual update or Excel)
   */
  async adjustStock(productId: string, newTotalStock: number) {
    const updated = await this.productModel.findByIdAndUpdate(
      productId,
      { stock: newTotalStock },
      { new: true },
    );

    if (updated) {
      this.emitUpdate(updated);
    }
    await this.cache.delByPrefix('products:');
    return updated;
  }
}
