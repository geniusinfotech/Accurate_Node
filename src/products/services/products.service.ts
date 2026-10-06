import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { extname } from 'path';
import axios from 'axios';
import { Product, ProductDocument } from '../schemas/product.schema';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { BrandsService } from './brands.service';
import { CategoriesService } from '../../categories/categories.service';
import { FileStorageUtil } from '../utils/file-storage.util';
import { RedisCacheService } from '../../common/cache/cache.service';

type ProductListResult = {
  products: ProductDocument[];
  items: ProductDocument[];
  total: number;
  count: number;
  page: number;
  limit: number;
  totalPages: number;
};

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private brandsService: BrandsService,
    private categoriesService: CategoriesService,
    private cache: RedisCacheService,
  ) {}

  private normalizeVariants(variants: any[] | undefined): any[] | undefined {
    if (!Array.isArray(variants)) return variants;
    const seenIds = new Set<string>();
    return variants.map((v: any, i: number) => {
      const out: any = { ...v };
      // Parse "500 ml" / "1kg" weight labels into packSize + packUnit
      if (
        (out.packSize === undefined || out.packSize === null || out.packSize === '') &&
        typeof out.weight === 'string' &&
        out.weight.trim()
      ) {
        const m = out.weight
          .trim()
          .replace(/\s+/g, ' ')
          .match(/^([\d.,]+)\s*([a-zA-Z]+)?/);
        if (m) {
          const size = parseFloat(m[1].replace(/,/g, ''));
          let unit = (m[2] || 'ml').toLowerCase();
          if (['g', 'gm', 'gms', 'gram', 'grams'].includes(unit)) unit = 'gm';
          else if (['kgs', 'kilogram', 'kilograms'].includes(unit)) unit = 'kg';
          else if (
            ['ltr', 'ltrs', 'litre', 'liter', 'litres', 'liters', 'lt'].includes(unit)
          )
            unit = 'L';
          else if (unit === 'l') unit = 'L';
          else if (unit === 'mls') unit = 'ml';
          if (!['ml', 'L', 'gm', 'kg'].includes(unit)) unit = 'ml';
          if (Number.isFinite(size) && size > 0) {
            out.packSize = size;
            out.packUnit = unit;
          }
        }
      }
      // Backfill weight label so storefront can display it
      if (!out.weight && out.packSize && out.packUnit) {
        out.weight = `${out.packSize} ${out.packUnit}`;
      }
      if (!out.variantId) {
        out.variantId = `VAR-${Date.now().toString(36).toUpperCase()}${i}`;
      }
      // De-duplicate variantIds within the product so stored data stays unique
      // (heals rows previously saved with identical generated ids).
      let baseId = String(out.variantId);
      let suffix = 1;
      while (seenIds.has(baseId)) {
        baseId = `${out.variantId}-${suffix++}`;
      }
      out.variantId = baseId;
      seenIds.add(baseId);
      if (typeof out.sku === 'string') {
        out.sku = out.sku.trim().toUpperCase();
      }
      if (out.price !== undefined) out.price = Number(out.price);
      if (out.mrp !== undefined && out.mrp !== null && out.mrp !== '') {
        out.mrp = Number(out.mrp);
      } else {
        delete out.mrp;
      }
      if (out.stock !== undefined) out.stock = Number(out.stock);
      if (out.isActive === undefined) out.isActive = true;
      return out;
    });
  }

  async create(dto: CreateProductDto): Promise<ProductDocument> {
    if (dto.brandId) {
      await this.brandsService.findById(dto.brandId);
    }

    await this.categoriesService.findById(dto.categoryId);

    const existingProduct = await this.productModel.findOne({ sku: dto.sku });
    if (existingProduct) {
      throw new ConflictException(`Product with SKU ${dto.sku} already exists`);
    }

    const status = dto.status || 'published';

    const normalizedVariants = this.normalizeVariants(dto.variants as any);

    const product = new this.productModel({
      ...dto,
      variants: normalizedVariants,
      status,
    });
    return product.save();
  }

  async findAll(filters: any = {}): Promise<ProductListResult> {
    const {
      page = 1,
      limit = 12,
      brandId,
      categoryId,
      isActive,
      status,
      includeUnpublished,
      search,
      minPrice,
      maxPrice,
      sort,
      ...rest
    } = filters;

    const query: any = {};

    if (brandId) query.brandId = brandId;
    if (categoryId) query.categoryId = categoryId;
    if (isActive !== undefined) query.isActive = isActive;
    if (status) query.status = status;
    if (!includeUnpublished) query.status = 'published';

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ];
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined) query.price.$gte = minPrice;
      if (maxPrice !== undefined) query.price.$lte = maxPrice;
    }

    Object.keys(rest).forEach((key) => {
      if (rest[key] !== undefined) query[key] = rest[key];
    });

    const skip = (page - 1) * limit;
    const sortOption = this.getSortOption(sort);

    const [items, total] = await Promise.all([
      this.productModel.find(query).sort(sortOption).skip(skip).limit(limit).populate('category', 'name').exec(),
      this.productModel.countDocuments(query).exec(),
    ]);

    return {
      products: items,
      items,
      total,
      count: items.length,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  getSortOption(sort?: string): any {
    switch (sort) {
      case 'price_asc':
        return { price: 1 };
      case 'price_desc':
        return { price: -1 };
      case 'newest':
        return { createdAt: -1 };
      default:
        return { createdAt: -1 };
    }
  }

  async findById(
    id: string,
    options: { includeUnpublished?: boolean } = {},
  ): Promise<ProductDocument> {
    const query: any = { _id: id };
    if (!options.includeUnpublished) {
      query.status = 'published';
    }
    const product = await this.productModel.findOne(query).populate('category', 'name').exec();
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductDocument> {
    const payload: any = { ...dto };
    if (payload.variants !== undefined) {
      payload.variants = this.normalizeVariants(payload.variants);
    }
    const product = await this.productModel
      .findByIdAndUpdate(id, payload, { new: true })
      .exec();
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async delete(id: string): Promise<void> {
    const result = await this.productModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
  }

  async uploadImages(id: string, files: Express.Multer.File[]): Promise<ProductDocument> {
    const imageUrls: string[] = [];
    const uploadDir = './uploads/images/products';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    for (const file of files) {
      const filename = `product-${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname).toLowerCase()}`;
      const destPath = path.join(uploadDir, filename);
      fs.renameSync(file.path, destPath);
      imageUrls.push(`/uploads/images/products/${filename}`);
    }

    const product = await this.productModel
      .findByIdAndUpdate(id, { $push: { images: { $each: imageUrls } } }, { new: true })
      .exec();
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async uploadVariantImages(
    id: string,
    variantKey: string,
    files: Express.Multer.File[],
  ): Promise<ProductDocument> {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one image is required');
    }
    const imageUrls: string[] = [];
    const uploadDir = './uploads/images/products';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    for (const file of files) {
      const filename = `product-${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname).toLowerCase()}`;
      const destPath = path.join(uploadDir, filename);
      fs.renameSync(file.path, destPath);
      imageUrls.push(`/uploads/images/products/${filename}`);
    }

    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    const needle = String(variantKey || '').trim().toUpperCase();
    const variant = ((product as any).variants || []).find(
      (v: any) =>
        String(v.sku || '').toUpperCase() === needle ||
        String(v.variantId || '').toUpperCase() === needle,
    );
    if (!variant) {
      throw new NotFoundException(
        `Variant ${variantKey} not found on product ${id}`,
      );
    }
    variant.images = [...(variant.images || []), ...imageUrls].slice(0, 10);
    await product.save();
    return product;
  }

  async downloadExternalImages(id: string, imageUrls: string[]): Promise<ProductDocument> {
    const downloadedUrls: string[] = [];
    const uploadDir = './uploads/images/products';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    for (const url of imageUrls) {
      try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const contentType = Array.isArray(response.headers['content-type'])
          ? response.headers['content-type'][0]
          : response.headers['content-type'];
        const contentTypeStr = typeof contentType === 'string' ? contentType : '';
        const ext = contentTypeStr.includes('png') ? '.png' : contentTypeStr.includes('webp') ? '.webp' : '.jpg';
        const filename = `product-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        const destPath = path.join(uploadDir, filename);
        const buffer = Buffer.from(response.data);
        fs.writeFileSync(destPath, buffer);
        downloadedUrls.push(`/uploads/images/products/${filename}`);
      } catch (error) {
        this.logger.error(`Failed to download image from ${url}: ${error.message}`);
      }
    }

    const product = await this.productModel
      .findByIdAndUpdate(id, { $push: { images: { $each: downloadedUrls } } }, { new: true })
      .exec();
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async bulkUploadFromExcel(
    file: Express.Multer.File,
    brandId: string,
    categoryId: string,
    userId: string,
  ): Promise<any> {
    const workbook = new ExcelJS.Workbook();
    const buffer = Buffer.isBuffer(file.buffer) 
      ? file.buffer 
      : Buffer.from(file.buffer as unknown as ArrayBuffer);
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    const results = { created: 0, updated: 0, errors: [] as string[] };
    const rows: any[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      rows.push({ row, rowNumber });
    });

    for (const { row, rowNumber } of rows) {
      const name = row.getCell(1)?.value?.toString()?.trim();
      const sku = row.getCell(2)?.value?.toString()?.trim();
      const price = parseFloat(row.getCell(3)?.value?.toString() || '0');
      const stock = parseInt(row.getCell(4)?.value?.toString() || '0', 10);
      const description = row.getCell(5)?.value?.toString()?.trim() || '';

      if (!name || !sku || price <= 0) {
        results.errors.push(`Row ${rowNumber}: Invalid data`);
        continue;
      }

      try {
        const existing = await this.productModel.findOne({ sku }).exec();
        if (existing) {
          existing.name = name;
          existing.price = price;
          existing.stock = stock;
          existing.description = description;
          await existing.save();
          results.updated++;
        } else {
          await this.productModel.create({
            name,
            sku,
            price,
            stock,
            description,
            brandId,
            categoryId,
            status: 'pending',
            isActive: true,
          });
          results.created++;
        }
      } catch (error) {
        results.errors.push(`Row ${rowNumber}: ${error.message}`);
      }
    }

    return results;
  }

  async getFilterOptions() {
    const [brands, categories, tags] = await Promise.all([
      this.brandsService.findAll({ isActive: true }),
      this.categoriesService.findAll(),
      this.productModel.distinct('tags').exec(),
    ]);

    return { brands, categories, tags };
  }
}