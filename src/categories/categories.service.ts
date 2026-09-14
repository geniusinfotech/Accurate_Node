/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, extname } from 'path';
import { RedisCacheService } from '../common/cache/cache.service';

@Injectable()
export class CategoriesService {
    private readonly uploadDir = join(
        process.cwd(),
        'uploads',
        'images',
        'categories',
    );

    constructor(
        @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
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

    async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
        const createdCategory = new this.categoryModel(createCategoryDto);
        await createdCategory.save();
        await this.cache.delByPrefix('categories:');
        return createdCategory;
    }

    async findAll(): Promise<Category[]> {
        const cacheKey = 'categories:v1:all';
        const cached = await this.cache.get<Category[]>(cacheKey);
        if (cached) return cached;

        const categories = await this.categoryModel.find();
        await this.cache.set(cacheKey, categories);
        return categories;
    }

    async findOne(id: string): Promise<Category> {
        const cacheKey = `categories:v1:byId:${id}`;
        const cached = await this.cache.get<Category>(cacheKey);
        if (cached) return cached;

        const category = await this.categoryModel.findById(id);
        if (!category) {
            throw new NotFoundException(`Category with ID ${id} not found`);
        }
        await this.cache.set(cacheKey, category);
        return category;
    }

    // Alias for consistency
    async findById(id: string): Promise<Category> {
        return this.findOne(id);
    }

    async update(id: string, updateCategoryDto: any, newImageFilename?: string): Promise<Category> {
        const existing = await this.categoryModel.findById(id);
        if (!existing) {
            throw new NotFoundException(`Category with ID ${id} not found`);
        }

        const updateData: any = { ...updateCategoryDto };

        if (newImageFilename) {
            if (existing.homepageCoverImage) {
                this.removeImage(existing.homepageCoverImage);
            }
            updateData.homepageCoverImage = newImageFilename;
        }

        const updatedCategory = await this.categoryModel
            .findByIdAndUpdate(id, updateData, { new: true });
        if (!updatedCategory) {
            throw new NotFoundException(`Category with ID ${id} not found`);
        }
        await this.cache.delByPrefix('categories:');
        return updatedCategory;
    }

    async remove(id: string): Promise<Category> {
        const deletedCategory = await this.categoryModel.findByIdAndDelete(id);
        if (!deletedCategory) {
            throw new NotFoundException(`Category with ID ${id} not found`);
        }
        await this.cache.delByPrefix('categories:');
        return deletedCategory;
    }

}
