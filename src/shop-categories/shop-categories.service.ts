/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ShopCategory, ShopCategoryDocument } from './schemas/shop-category.schema';
import { CreateShopCategoryDto } from './dto/create-shop-category.dto';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, extname } from 'path';
import { RedisCacheService } from '../common/cache/cache.service';

@Injectable()
export class ShopCategoriesService {
    private readonly uploadDir = join(
        process.cwd(),
        'uploads',
        'images',
        'shop-categories',
    );

    constructor(
        @InjectModel(ShopCategory.name) private shopCategoryModel: Model<ShopCategoryDocument>,
        private cache: RedisCacheService,
    ) {
        if (!existsSync(this.uploadDir)) {
            mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    saveImage(file: Express.Multer.File): string {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        const filename = `cat-${uniqueSuffix}${ext}`;
        const destPath = join(this.uploadDir, filename);

        const fs = require('fs');
        fs.writeFileSync(destPath, file.buffer);
        return filename;
    }

    removeImage(filename: string): void {
        try {
            const filePath = join(this.uploadDir, filename);
            if (existsSync(filePath)) {
                unlinkSync(filePath);
            }
        } catch {}
    }

    async create(createShopCategoryDto: CreateShopCategoryDto): Promise<ShopCategory> {
        const createdShopCategory = new this.shopCategoryModel(createShopCategoryDto);
        await createdShopCategory.save();
        await this.cache.delByPrefix('shopCategories:');
        return createdShopCategory;
    }

    async findAll(): Promise<ShopCategory[]> {
        const cacheKey = 'shopCategories:v1:all';
        const cached = await this.cache.get<ShopCategory[]>(cacheKey);
        if (cached) return cached;

        const shopCategories = await this.shopCategoryModel.find();
        await this.cache.set(cacheKey, shopCategories);
        return shopCategories;
    }

    async findOne(id: string): Promise<ShopCategory> {
        const cacheKey = `shopCategories:v1:byId:${id}`;
        const cached = await this.cache.get<ShopCategory>(cacheKey);
        if (cached) return cached;

        const shopCategory = await this.shopCategoryModel.findById(id);
        if (!shopCategory) {
            throw new NotFoundException(`ShopCategory with ID ${id} not found`);
        }
        await this.cache.set(cacheKey, shopCategory);
        return shopCategory;
    }

    // Alias for consistency
    async findById(id: string): Promise<ShopCategory> {
        return this.findOne(id);
    }

    async update(id: string, updateShopCategoryDto: any, newImageFilename?: string): Promise<ShopCategory> {
        const existing = await this.shopCategoryModel.findById(id);
        if (!existing) {
            throw new NotFoundException(`ShopCategory with ID ${id} not found`);
        }

        const updateData: any = { ...updateShopCategoryDto };

        if (newImageFilename) {
            if (existing.homepageCoverImage) {
                this.removeImage(existing.homepageCoverImage);
            }
            updateData.homepageCoverImage = newImageFilename;
        }

        const updatedShopCategory = await this.shopCategoryModel
            .findByIdAndUpdate(id, updateData, { new: true });
        if (!updatedShopCategory) {
            throw new NotFoundException(`ShopCategory with ID ${id} not found`);
        }
        await this.cache.delByPrefix('shopCategories:');
        return updatedShopCategory;
    }

    async remove(id: string): Promise<ShopCategory> {
        const deletedShopCategory = await this.shopCategoryModel.findByIdAndDelete(id);
        if (!deletedShopCategory) {
            throw new NotFoundException(`ShopCategory with ID ${id} not found`);
        }
        await this.cache.delByPrefix('shopCategories:');
        return deletedShopCategory;
    }

}
