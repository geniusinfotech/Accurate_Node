/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Wishlist, WishlistDocument } from './schemas/wishlist.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';

@Injectable()
export class WishlistService {
  constructor(
    @InjectModel(Wishlist.name) private wishlistModel: Model<WishlistDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) { }

  // Add product to wishlist
  async addToWishlist(userId: string, productId: string): Promise<Wishlist> {
    // Verify product exists
    const product = await this.productModel.findById(productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    try {
      const wishlistItem = new this.wishlistModel({
        userId: new Types.ObjectId(userId),
        productId: new Types.ObjectId(productId),
      });
      return await wishlistItem.save();
    } catch (error) {
      // Handle duplicate key error (product already in wishlist)
      if (error.code === 11000) {
        throw new ConflictException('Product already in wishlist');
      }
      throw error;
    }
  }

  // Get user's wishlist with populated product details
  async getUserWishlist(userId: string): Promise<any[]> {
    const wishlist = await this.wishlistModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('productId');

    return wishlist.map(item => ({
      _id: item._id,
      product: item.productId,
      addedAt: item.createdAt,
    }));
  }

  // Get wishlist for a specific user (admin view)
  async getWishlistByUserId(userId: string): Promise<any[]> {
    return this.getUserWishlist(userId);
  }

  // Remove product from wishlist
  async removeFromWishlist(userId: string, productId: string): Promise<{ message: string }> {
    const result = await this.wishlistModel
      .findOneAndDelete({
        userId: new Types.ObjectId(userId),
        productId: new Types.ObjectId(productId),
      });

    if (!result) {
      throw new NotFoundException('Product not found in wishlist');
    }

    return { message: 'Product removed from wishlist' };
  }

  // Clear entire wishlist
  async clearWishlist(userId: string): Promise<{ message: string }> {
    await this.wishlistModel
      .deleteMany({ userId: new Types.ObjectId(userId) });

    return { message: 'Wishlist cleared successfully' };
  }

  // Check if product is in wishlist
  async isInWishlist(userId: string, productId: string): Promise<boolean> {
    const item = await this.wishlistModel
      .findOne({
        userId: new Types.ObjectId(userId),
        productId: new Types.ObjectId(productId),
      });

    return !!item;
  }

  // Get wishlist count
  async getWishlistCount(userId: string): Promise<number> {
    return this.wishlistModel
      .countDocuments({ userId: new Types.ObjectId(userId) });
  }
}
