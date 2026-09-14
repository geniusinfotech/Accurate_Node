/* eslint-disable prettier/prettier */
import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { AddToWishlistDto } from './dto/add-to-wishlist.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('wishlist')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private wishlistService: WishlistService) { }

  // Add product to wishlist
  @Post()
  async addToWishlist(@Request() req, @Body() dto: AddToWishlistDto) {
    const userId = req.user.userId;
    return this.wishlistService.addToWishlist(userId, dto.productId);
  }

  // Get user's wishlist
  @Get()
  async getWishlist(@Request() req) {
    const userId = req.user.userId;
    return this.wishlistService.getUserWishlist(userId);
  }
  // Get wishlist count
  @Get('count')
  async getWishlistCount(@Request() req) {
    const userId = req.user.userId;
    const count = await this.wishlistService.getWishlistCount(userId);
    return { count };
  }

  // Check if product is in wishlist
  @Get('check/:productId')
  async checkInWishlist(@Request() req, @Param('productId') productId: string) {
    const userId = req.user.userId;
    const isInWishlist = await this.wishlistService.isInWishlist(userId, productId);
    return { isInWishlist };
  }

  // Remove product from wishlist
  @Delete(':productId')
  async removeFromWishlist(@Request() req, @Param('productId') productId: string) {
    const userId = req.user.userId;
    return this.wishlistService.removeFromWishlist(userId, productId);
  }

  // Clear entire wishlist
  @Delete()
  async clearWishlist(@Request() req) {
    const userId = req.user.userId;
    return this.wishlistService.clearWishlist(userId);
  }
}
