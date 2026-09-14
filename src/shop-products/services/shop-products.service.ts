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
import axios from 'axios';
import {
  ShopProduct,
  ShopProductDocument,
} from '../schemas/shop-product.schema';
import {
  ExcelUploadHistory,
  ExcelUploadHistoryDocument,
} from '../schemas/excel-upload-history.schema';
import { CreateShopProductDto } from '../dto/create-shop-product.dto';
import { UpdateShopProductDto } from '../dto/update-shop-product.dto';
import { ShopBrandsService } from './shop-brands.service';
import { ShopCategoriesService } from '../../shop-categories/shop-categories.service';
import { SemiFinishedStockService } from '../../manufacturing/semi-finished-stock/semi-finished-stock.service';
import {
  RawMaterial,
  RawMaterialDocument,
} from '../../manufacturing/raw-materials/schemas/raw-material.schema';
import {
  SemiFinishedStock,
  SemiFinishedStockDocument,
} from '../../manufacturing/semi-finished-stock/schemas/semi-finished-stock.schema';
import { FileStorageUtil } from '../utils/file-storage.util';
import { RedisCacheService } from '../../common/cache/cache.service';

type RawMaterialNames = ShopProductDocument & { rawMaterialNames: string[] };

type ShopProductListResult = {
  shopProducts: RawMaterialNames[];
  items: RawMaterialNames[];
  total: number;
  count: number;
  page: number;
  limit: number;
};

@Injectable()
export class ShopProductsService {
  private readonly logger = new Logger(ShopProductsService.name);

  constructor(
    @InjectModel(ShopProduct.name)
    private shopProductModel: Model<ShopProductDocument>,
    @InjectModel(ExcelUploadHistory.name)
    private excelHistoryModel: Model<ExcelUploadHistoryDocument>,
    @InjectModel(RawMaterial.name)
    private rawMaterialModel: Model<RawMaterialDocument>,
    @InjectModel(SemiFinishedStock.name)
    private stockModel: Model<SemiFinishedStockDocument>,
    private shopBrandsService: ShopBrandsService,
    private shopCategoriesService: ShopCategoriesService,
    private semiFinishedStockService: SemiFinishedStockService,
    private cache: RedisCacheService,
  ) {}

  /**
   * Create a new shopProduct manually
   */
  async create(dto: CreateShopProductDto): Promise<ShopProductDocument> {
    // Validate shopBrand exists
    if (dto.shopBrandId) {
      await this.shopBrandsService.findById(dto.shopBrandId);
    }

    // Validate shopCategory exists
    await this.shopCategoriesService.findById(dto.shopCategoryId);

    // Check if SKU already exists
    const existingShopProduct = await this.shopProductModel.findOne({
      sku: dto.sku,
    });
    if (existingShopProduct) {
      throw new ConflictException(
        `ShopProduct with SKU ${dto.sku} already exists`,
      );
    }

    const status = dto.status;
    if (status === 'published') {
      if (!dto.sourceStockId) {
        throw new BadRequestException(
          'sourceStockId is required to publish a shopProduct',
        );
      }
      const stock = await this.semiFinishedStockService.findOne(
        dto.sourceStockId,
      );
      if (stock.status !== 'completed' && stock.status !== 'ready') {
        throw new BadRequestException(
          'Associated stock must be in completed or ready status to publish',
        );
      }
    }

    let shopProductLotId = dto.lotId;
    if (!shopProductLotId && dto.sourceStockId) {
      try {
        const sourceStock = await this.semiFinishedStockService.findOne(
          dto.sourceStockId,
        );
        if (sourceStock?.lotId) {
          shopProductLotId = sourceStock.lotId;
        }
      } catch (err) {
        // non-critical
      }
    }

    // Merge any user-supplied tags with inferred gifting tags
    const inferredTags = this.inferGiftingTags(dto.name, dto.description);
    const mergedTags = [...new Set([...(dto.tags ?? []), ...inferredTags])];

    const shopProduct = new this.shopProductModel({
      ...dto,
      tags: mergedTags,
      lotId: shopProductLotId,
      reservedStock: 0,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
      status: status,
    });

    const saved = await shopProduct.save();

    if (dto.sourceStockId) {
      try {
        await this.semiFinishedStockService.update(dto.sourceStockId, {
          status: 'published',
        } as any);
      } catch (err) {
        // non-critical: shopProduct created even if stock status update fails
        console.error('Failed to mark stock as published:', err);
      }
    }

    await this.cache.delByPrefix('shopProducts:');
    return saved;
  }

  /**
   * Bulk upload shopProducts from Excel file
   */
  async bulkUploadFromExcel(
    file: Express.Multer.File,
    shopBrandId: string,
    shopCategoryId: string,
    userId: string,
  ): Promise<{
    created: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
  }> {
    const errors: Array<{ row: number; error: string }> = [];
    let created = 0;
    let failed = 0;

    try {
      this.assertAllowedMagicBytes(file.path, ['excel']);

      // Validate shopBrand and shopCategory exist
      const shopBrand = await this.shopBrandsService.findById(shopBrandId);
      const shopCategory =
        await this.shopCategoriesService.findById(shopCategoryId);

      // Parse Excel file using ExcelJS
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(file.path);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        fs.unlinkSync(file.path);
        throw new BadRequestException('Excel file has no worksheets');
      }

      // Extract headers from the first row
      const headers: string[] = [];
      const headerRow = worksheet.getRow(1);
      if (headerRow.cellCount === 0) {
        fs.unlinkSync(file.path);
        throw new BadRequestException('Excel file is empty');
      }

      headerRow.eachCell((cell, colNumber) => {
        headers[colNumber] = cell.text ? cell.text.toString().trim() : '';
      });

      // Count actual data rows (excluding header)
      const rowCount = worksheet.rowCount - 1;

      // Enforce 10000 shopProduct limit
      if (rowCount > 10000) {
        fs.unlinkSync(file.path);
        throw new BadRequestException(
          'Maximum 10000 shopProducts allowed per upload',
        );
      }

      if (rowCount <= 0) {
        fs.unlinkSync(file.path);
        throw new BadRequestException('Excel file is empty of data');
      }

      // Validate column headers
      const headerValues = headers.filter(Boolean);
      const requiredFields = ['name', 'price', 'stock'];
      const missingHeaders = requiredFields.filter(
        (field) => !headerValues.some((h) => h.toLowerCase().trim() === field),
      );
      if (missingHeaders.length > 0) {
        fs.unlinkSync(file.path);
        throw new BadRequestException(
          `Missing required columns in header row: ${missingHeaders.join(', ')}`,
        );
      }

      // Parse all rows first
      const parsedRows: Array<{ rowIndex: number; data: any }> = [];
      for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        if (row.hasValues) {
          const rowData: any = {};
          headers.forEach((header, index) => {
            if (header && index > 0) {
              const cell = row.getCell(index);
              const normalizedValue = this.normalizeCellValue(cell);
              rowData[header] = normalizedValue;
            }
          });
          parsedRows.push({
            rowIndex: i,
            data: this.normalizeObjectKeys(rowData),
          });
        }
      }

      // --- Pre-validation phase: validate ALL rows before creating any ---
      const validatedRows: Array<{
        rowIndex: number;
        data: any;
        errors: string[];
      }> = [];
      const fileSkus = new Map<string, number>();

      for (const { rowIndex, data } of parsedRows) {
        const rowErrors: string[] = [];

        // Check required fields (with whitespace trimming)
        const missingFields = requiredFields.filter((field) => {
          const val = data[field];
          if (val === undefined || val === null) return true;
          if (typeof val === 'string' && val.trim() === '') return true;
          return false;
        });
        if (missingFields.length > 0) {
          rowErrors.push(
            `Missing required fields: ${missingFields.join(', ')}`,
          );
        }

        // Validate name
        const name = data.name ? data.name.toString().trim() : '';
        if (!name) {
          if (!missingFields.includes('name')) {
            rowErrors.push('ShopProduct name cannot be empty');
          }
        } else if (name.length > 500) {
          rowErrors.push('ShopProduct name must be 500 characters or less');
        }

        // Validate price
        if (
          data.price !== undefined &&
          data.price !== '' &&
          data.price !== null
        ) {
          const priceNum = parseFloat(data.price);
          if (isNaN(priceNum)) {
            rowErrors.push('Price must be a valid number');
          } else if (priceNum <= 0) {
            rowErrors.push('Price must be greater than zero');
          } else if (priceNum > 999999999) {
            rowErrors.push('Price is too large');
          }
        }

        // Validate stock
        if (
          data.stock !== undefined &&
          data.stock !== '' &&
          data.stock !== null
        ) {
          const stockNum = parseInt(data.stock, 10);
          if (isNaN(stockNum)) {
            rowErrors.push('Stock must be a valid integer');
          } else if (stockNum < 0) {
            rowErrors.push('Stock cannot be negative');
          } else if (stockNum > 999999999) {
            rowErrors.push('Stock value is too large');
          }
        }

        // Validate discount (0-100)
        if (
          data.discount !== undefined &&
          data.discount !== '' &&
          data.discount !== null
        ) {
          const discountNum = parseFloat(data.discount);
          if (isNaN(discountNum)) {
            rowErrors.push('Discount must be a valid number');
          } else if (discountNum < 0 || discountNum > 100) {
            rowErrors.push('Discount must be between 0 and 100');
          }
        }

        // Auto-generate SKU if not provided
        if (!data.sku && name) {
          data.sku = this.generateSku(name, rowIndex);
        }

        // Validate SKU
        if (data.sku) {
          const skuStr = data.sku.toString().trim();
          data.sku = skuStr;
          if (skuStr.length > 200) {
            rowErrors.push('SKU must be 200 characters or less');
          }
        }

        validatedRows.push({ rowIndex, data, errors: rowErrors });
      }

      // Check for duplicate SKUs within the file
      const skuCountMap = new Map<string, number[]>();
      for (const { rowIndex, data } of parsedRows) {
        if (data.sku) {
          const sku = data.sku.toString().trim();
          if (!skuCountMap.has(sku)) {
            skuCountMap.set(sku, []);
          }
          skuCountMap.get(sku)!.push(rowIndex);
        }
      }
      for (const [sku, rows] of skuCountMap.entries()) {
        if (rows.length > 1) {
          for (const rowIndex of rows) {
            const vr = validatedRows.find((v) => v.rowIndex === rowIndex);
            if (vr) {
              vr.errors.push(
                `Duplicate SKU "${sku}" found in the file (also appears in rows: ${rows.filter((r) => r !== rowIndex).join(', ')})`,
              );
            }
          }
        }
      }

      // Check for SKUs already existing in the database
      const allSkus = parsedRows
        .map((r) => r.data.sku?.toString().trim())
        .filter(Boolean);
      const uniqueSkus = [...new Set<string>(allSkus)];
      if (uniqueSkus.length > 0) {
        const existingSkus = await this.shopProductModel
          .find({ sku: { $in: uniqueSkus } })
          .select('sku')
          .lean()
          .exec();
        const existingSkuSet = new Set(existingSkus.map((p: any) => p.sku));
        for (const { rowIndex, data } of parsedRows) {
          if (data.sku && existingSkuSet.has(data.sku.toString().trim())) {
            const vr = validatedRows.find((v) => v.rowIndex === rowIndex);
            if (vr) {
              vr.errors.push(
                `SKU "${data.sku}" already exists in the database`,
              );
            }
          }
        }
      }

      // Separate valid and invalid rows
      const validRows = validatedRows.filter((v) => v.errors.length === 0);
      const invalidRows = validatedRows.filter((v) => v.errors.length > 0);

      // Move file to organized storage (shared by both success and failure paths)
      const failedDir = invalidRows.length > 0 ? 'failed' : '';
      const storageBasePath = FileStorageUtil.getExcelStoragePath(
        shopBrand.code,
        shopCategory.slug,
      );
      const storagePath = failedDir
        ? path.join(storageBasePath, failedDir)
        : storageBasePath;
      const newFileName = FileStorageUtil.generateUniqueFilename(
        file.originalname,
      );
      const newFilePath = path.join(storagePath, newFileName);
      fs.mkdirSync(path.dirname(newFilePath), { recursive: true });
      fs.renameSync(file.path, newFilePath);

      // Build validation error entries for DB
      const validationErrors = invalidRows.map((v) => ({
        row: v.rowIndex,
        error: v.errors.join('; '),
      }));

      this.logger.log(
        `Excel upload: ${parsedRows.length} parsed, ${validRows.length} valid, ${invalidRows.length} invalid`,
      );

      // --- Creation phase: create all valid rows ---
      for (const { rowIndex, data } of validRows) {
        try {
          const { name, sku, price, stock, description, discount, ...specs } =
            data;

          const nameStr = name ? name.toString().trim() : '';
          const priceNum = price !== undefined ? parseFloat(price) : 0;
          const stockNum = stock !== undefined ? parseInt(stock, 10) : 0;
          const discountNum = discount ? parseFloat(discount) : 0;

          if (!nameStr) {
            throw new Error('ShopProduct name is empty after trimming');
          }
          if (isNaN(priceNum) || priceNum <= 0) {
            throw new Error(`Invalid price: ${price}`);
          }
          if (isNaN(stockNum) || stockNum < 0) {
            throw new Error(`Invalid stock: ${stock}`);
          }
          if (isNaN(discountNum) || discountNum < 0 || discountNum > 100) {
            throw new Error(`Invalid discount: ${discount}`);
          }

          const finalSku = sku ? sku.toString().trim() : '';

          if (!finalSku) {
            throw new Error('SKU could not be generated');
          }
          if (finalSku.length > 200) {
            throw new Error('Generated SKU exceeds 200 characters');
          }

          const descStr = description ? description.toString().trim() : '';

          // Infer gifting tags from name and description
          const rowTagsRaw: string[] = data.tags
            ? typeof data.tags === 'string'
              ? data.tags
                  .split(',')
                  .map((t: string) => t.trim())
                  .filter(Boolean)
              : Array.isArray(data.tags)
                ? data.tags
                : []
            : [];
          const inferredRowTags = this.inferGiftingTags(nameStr, descStr);
          const rowTags = [...new Set([...rowTagsRaw, ...inferredRowTags])];

          const shopProduct = new this.shopProductModel({
            name: nameStr,
            sku: finalSku,
            price: priceNum,
            stock: stockNum,
            shopBrandId,
            shopCategoryId,
            description: descStr,
            discount: discountNum,
            tags: rowTags,
            specs: specs || {},
            reservedStock: 0,
            isActive: true,
            status: 'pending',
          });

          await shopProduct.save();
          created++;
        } catch (error) {
          failed++;
          const msg = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(`Row ${rowIndex} creation failed: ${msg}`);
          errors.push({
            row: rowIndex,
            error: msg,
          });
        }
      }

      this.logger.log(
        `Excel upload complete: ${created} created, ${failed} failed`,
      );

      // Save upload history (records both created count and validation errors)
      const history = new this.excelHistoryModel({
        shopBrandId,
        shopCategoryId,
        fileName: file.originalname,
        filePath: newFilePath,
        uploadedBy: userId,
        uploadedShopProducts: created,
        failedCount: validationErrors.length + failed,
        status: created > 0 ? 'completed' : 'validated',
        validationErrors: [...validationErrors, ...errors],
      });
      await history.save();

      if (created > 0) {
        await this.cache.delByPrefix('shopProducts:');
      }

      return {
        created,
        failed: validationErrors.length + failed,
        errors: [...validationErrors, ...errors],
      };
    } catch (error) {
      // Clean up file on error
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  }

  /**
   * Normalize a single cell value from ExcelJS
   */
  private normalizeCellValue(cell: ExcelJS.Cell): any {
    if (!cell || cell.value === null || cell.value === undefined) {
      return '';
    }

    // Handle Rich Text (array of objects with 'text' property)
    if (typeof cell.value === 'object' && 'richText' in cell.value) {
      return (cell.value as any).richText.map((rt: any) => rt.text).join('');
    }

    // Handle Hyperlinks
    if (
      typeof cell.value === 'object' &&
      'text' in cell.value &&
      'hyperlink' in cell.value
    ) {
      return (cell.value as any).text;
    }

    // Handle Formulas (ExcelJS returns object with { formula, result })
    if (typeof cell.value === 'object' && 'formula' in cell.value) {
      return (cell.value as any).result; // We want the calculated result
    }

    // Handle dates
    if (cell.type === ExcelJS.ValueType.Date) {
      return cell.value.toString();
    }

    return cell.value.toString();
  }

  /**
   * Normalize object keys (lowercase and trim)
   */
  private normalizeObjectKeys(row: any): any {
    const normalized: any = {};
    for (const key in row) {
      const normalizedKey = key.toLowerCase().trim();
      normalized[normalizedKey] = row[key];
    }
    return normalized;
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private addRegexOrFilter(query: any, paths: string[], value?: string) {
    if (!value) return;

    const regex = new RegExp(this.escapeRegex(value), 'i');
    const clauses = paths.map((path) => ({ [path]: regex }));

    if (query.$or) {
      query.$and = [
        ...(query.$and || []),
        { $or: query.$or },
        { $or: clauses },
      ];
      delete query.$or;
      return;
    }

    query.$and = [...(query.$and || []), { $or: clauses }];
  }

  private normalizeFilterValue(value: unknown): string | null {
    if (value === null || value === undefined) return null;

    const normalized = String(value).replace(/\s+/g, ' ').trim();

    return normalized.length > 0 ? normalized : null;
  }

  private addOption(
    target: Set<string>,
    shopProduct: any,
    topLevelKeys: string[],
    specKeys: string[],
  ) {
    for (const key of topLevelKeys) {
      const value = this.normalizeFilterValue(shopProduct[key]);
      if (value) target.add(value);
    }

    const specs = shopProduct.specs || {};
    for (const key of specKeys) {
      const value = this.normalizeFilterValue(specs[key]);
      if (value) target.add(value);
    }
  }

  private sortOptions(values: Set<string>): string[] {
    return [...values].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
    );
  }

  private generateSku(name: string, rowIndex: number): string {
    const prefix = name
      .replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toUpperCase()
      .slice(0, 5);

    const suffix = `${rowIndex}${Date.now().toString(36).slice(-3)}`;
    return `${prefix}-${suffix}`;
  }

  private assertAllowedMagicBytes(
    filePath: string,
    allowedTypes: Array<'image' | 'excel'>,
  ) {
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(filePath, 'r');
    try {
      fs.readSync(fd, buffer, 0, 12, 0);
    } finally {
      fs.closeSync(fd);
    }

    const hex = buffer.toString('hex');
    const isJpeg = hex.startsWith('ffd8ff');
    const isPng = hex.startsWith('89504e470d0a1a0a');
    const isGif = hex.startsWith('47494638');
    const isWebp =
      buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
      buffer.slice(8, 12).toString('ascii') === 'WEBP';
    const isZipBasedExcel = hex.startsWith('504b0304');
    const isLegacyExcel = hex.startsWith('d0cf11e0a1b11ae1');

    const isAllowed =
      (allowedTypes.includes('image') &&
        (isJpeg || isPng || isGif || isWebp)) ||
      (allowedTypes.includes('excel') && (isZipBasedExcel || isLegacyExcel));

    if (!isAllowed) {
      throw new BadRequestException(
        'Uploaded file content does not match the expected file type',
      );
    }
  }

  /**
   * Infer gifting audience tags from shopProduct name and description.
   * Returns any subset of: "for her", "for him", "couple", "kids", "sister", "friends".
   */
  private inferGiftingTags(name?: string, description?: string): string[] {
    const text = `${name ?? ''} ${description ?? ''}`.toLowerCase();
    const tags: string[] = [];

    // "for her" — feminine jewellery keywords
    if (
      /\b(her|women|woman|lady|ladies|girl|girls|bride|bridal|feminine|necklace|earring|bangle|maang\s*tikka|nose\s*pin|anklet|mangalsutra|choker|jhumka|jhumki)\b/.test(
        text,
      )
    ) {
      tags.push('for her');
    }

    // "for him" — masculine keywords
    if (
      /\b(him|men|man|groom|male|masculine|bracelet for men|chain for men|rudraksha|kada|pendant for men|ring for men)\b/.test(
        text,
      )
    ) {
      tags.push('for him');
    }

    // "couple" — couple/pair keywords
    if (
      /\b(couple|pair|his\s*&?\s*her|matching set|duo|together)\b/.test(text)
    ) {
      tags.push('couple');
    }

    // "kids" — children keywords
    if (
      /\b(kids|child|children|baby|toddler|infant|girl child|boy child|school)\b/.test(
        text,
      )
    ) {
      tags.push('kids');
    }

    // "sister" — explicit sister / rakhi keywords
    if (/\b(sister|sis|rakhi|rakshabandhan|raksha\s*bandhan)\b/.test(text)) {
      tags.push('sister');
    }

    // "friends" — friendship / bestie keywords
    if (/\b(friend|friends|bestie|bff|friendship|buddy|pal)\b/.test(text)) {
      tags.push('friends');
    }

    return tags;
  }

  private buildFindAllCacheKey(
    filters: any,
    page: number,
    limit: number,
  ): string {
    const key = {
      page,
      limit,
      shopBrandId: filters?.shopBrandId || '',
      shopCategoryId: filters?.shopCategoryId || '',
      search: filters?.search || '',
      sort: filters?.sort || '',
      minPrice: filters?.minPrice ?? '',
      maxPrice: filters?.maxPrice ?? '',
      isPremium: filters?.isPremium ?? '',
      processor: filters?.processor || '',
      ssd: filters?.ssd || '',
      ram: filters?.ram || '',
      gpuType: filters?.gpuType || '',
      gpuMemory: filters?.gpuMemory || '',
      displaySize: filters?.displaySize || '',
      isTouchScreen: filters?.isTouchScreen ?? '',
    };
    return JSON.stringify(key);
  }

  /**
   * Find all shopProducts with filters and pagination
   */
  async findAll(filters?: {
    shopBrandId?: string;
    shopCategoryId?: string;
    isActive?: boolean;
    status?: string;
    includeUnpublished?: boolean;
    search?: string;
    page?: number;
    limit?: number;
    minPrice?: number;
    maxPrice?: number;
    processor?: string;
    ssd?: string;
    ram?: string;
    gpuType?: string;
    gpuMemory?: string;
    displaySize?: string;
    isTouchScreen?: boolean;
    isPremium?: boolean;
    sort?: string;
  }): Promise<{
    shopProducts: ShopProductDocument[];
    items: ShopProductDocument[];
    total: number;
    count: number;
    page: number;
    limit: number;
  }> {
    const page = filters?.page || 1;
    const hardCap = filters?.includeUnpublished ? 1000 : 50;
    const limit = Math.min(filters?.limit || 12, hardCap); // enforce cap
    const skip = (page - 1) * limit;

    // Serve public catalog reads from Redis to reduce DB load.
    // Privileged/admin requests (includeUnpublished / explicit status) bypass caching.
    const cacheable = Boolean(
      filters &&
      !filters.includeUnpublished &&
      !filters.status &&
      !filters.isActive,
    );
    const cacheKey =
      'shopProducts:v1:' + this.buildFindAllCacheKey(filters, page, limit);
    if (cacheable) {
      const cached = await this.cache.get<ShopProductListResult>(cacheKey);
      if (cached) return cached;
    }

    const query: any = {};

    if (filters?.shopBrandId) {
      const raw = String(filters.shopBrandId);
      const shopBrandIds = raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => /^[a-fA-F0-9]{24}$/.test(s));
      if (shopBrandIds.length > 0) {
        query.shopBrandId = { $in: shopBrandIds };
      }
    }
    if (filters?.shopCategoryId) {
      const raw = String(filters.shopCategoryId);
      const shopCategoryIds = raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => /^[a-fA-F0-9]{24}$/.test(s));
      if (shopCategoryIds.length > 0) {
        query.shopCategoryId = { $in: shopCategoryIds };
      }
    }
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;
    if (filters?.isPremium !== undefined) query.isPremium = filters.isPremium;
    const normalizedStatus = filters?.status?.toLowerCase();
    if (normalizedStatus === 'pending' || normalizedStatus === 'published') {
      query.status = normalizedStatus;
    } else if (!filters?.includeUnpublished) {
      query.status = 'published';
    }
    if (filters?.search) {
      const searchRegex = new RegExp(this.escapeRegex(filters.search), 'i');
      query.$or = [
        { name: searchRegex },
        { sku: searchRegex },
        { description: searchRegex },
        { gpuType: searchRegex },
        { gpuMemory: searchRegex },
        { 'specs.processor': searchRegex },
        { 'specs.cpu': searchRegex },
        { 'specs.gpu': searchRegex },
        { 'specs.graphics': searchRegex },
        { 'specs.graphicsCard': searchRegex },
        { 'specs.graphics_card': searchRegex },
        { 'specs.videoCard': searchRegex },
        { 'specs.video_card': searchRegex },
        { 'specs.model': searchRegex },
      ];
    }

    if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
      query.price = {};
      if (filters.minPrice !== undefined) query.price.$gte = filters.minPrice;
      if (filters.maxPrice !== undefined) query.price.$lte = filters.maxPrice;
    }

    this.addRegexOrFilter(
      query,
      [
        'specs.processor',
        'specs.cpu',
        'specs.cpu model',
        'specs.processor model',
      ],
      filters?.processor,
    );
    this.addRegexOrFilter(
      query,
      ['specs.ssd', 'specs.storage', 'specs.storage capacity'],
      filters?.ssd,
    );
    this.addRegexOrFilter(
      query,
      ['specs.ram', 'specs.memory', 'specs.system memory'],
      filters?.ram,
    );
    this.addRegexOrFilter(
      query,
      ['gpuType', 'specs.gputype', 'specs.gpu type', 'specs.graphics type'],
      filters?.gpuType,
    );
    this.addRegexOrFilter(
      query,
      [
        'gpuMemory',
        'specs.gpumemory',
        'specs.gpu memory',
        'specs.graphics memory',
        'specs.vram',
      ],
      filters?.gpuMemory,
    );
    this.addRegexOrFilter(
      query,
      [
        'displaySize',
        'specs.display size',
        'specs.screen size',
        'specs.display',
      ],
      filters?.displaySize,
    );
    if (filters?.isTouchScreen !== undefined) {
      query.isTouchScreen = filters.isTouchScreen;
    }

    const sort: Record<string, 1 | -1> =
      filters?.sort === 'price_asc'
        ? { price: 1 }
        : filters?.sort === 'price_desc'
          ? { price: -1 }
          : filters?.sort === 'newest'
            ? { createdAt: -1 }
            : filters?.sort === 'rating'
              ? { averageRating: -1, createdAt: -1 }
              : { createdAt: -1 };

    const [shopProducts, total] = await Promise.all([
      this.shopProductModel
        .find(query)
        .populate('shopBrandId', 'name code')
        .populate('shopCategoryId', 'name slug')
        .skip(skip)
        .limit(limit)
        .sort(sort)
        .exec(),
      this.shopProductModel.countDocuments(query).exec(),
    ]);

    let enrichedShopProducts = await this.attachRawMaterialNames(shopProducts);

    enrichedShopProducts = enrichedShopProducts.map((product) => {
      if (product.dimensions) {
        const weightGrams = product.dimensions.weightGrams;
        if (weightGrams !== undefined && weightGrams !== null) {
          if (weightGrams < 1) {
            product.dimensions.weightGrams = Math.round(weightGrams * 1000);
            product.dimensions.weight = `${product.dimensions.weightGrams} gm`;
          } else {
            product.dimensions.weight = `${(weightGrams / 1000).toFixed(2)} kg`;
          }
        }
      }
      return product;
    });

    const result: ShopProductListResult = {
      shopProducts: enrichedShopProducts,
      items: enrichedShopProducts,
      total,
      count: total,
      page,
      limit,
    };

    if (cacheable) {
      await this.cache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Resolve the manufacturing raw material name(s) used by each shopProduct.
   * Traces via sourceStockId -> SemiFinishedStock -> rawMaterialId -> RawMaterial
   * and/or lotId -> RawMaterial (raw materials bought under that lot).
   * ShopProducts without stock/lot links get an empty array.
   */
  private async attachRawMaterialNames(
    shopProducts: ShopProductDocument[],
  ): Promise<Array<ShopProductDocument & { rawMaterialNames: string[] }>> {
    const stockIdToName = new Map<string, string>();
    const lotIdToNames: Record<string, string[]> = {};

    const sourceStockIds = shopProducts
      .map((p) =>
        p.sourceStockId
          ? (p.sourceStockId as { toString(): string }).toString()
          : null,
      )
      .filter(Boolean);
    const lotIds = [
      ...new Set(
        shopProducts.map((p) => p.lotId).filter((l): l is string => Boolean(l)),
      ),
    ];

    if (sourceStockIds.length > 0) {
      const stocks = await this.stockModel
        .find({ _id: { $in: sourceStockIds } })
        .populate('rawMaterialId')
        .exec();
      for (const s of stocks) {
        const rm = s.rawMaterialId as unknown as {
          materialName?: string;
        } | null;
        if (rm?.materialName) {
          stockIdToName.set(s._id.toString(), rm.materialName);
        }
      }
    }

    if (lotIds.length > 0) {
      const rawMaterials = await this.rawMaterialModel
        .find({ lotId: { $in: lotIds } })
        .exec();
      for (const rm of rawMaterials) {
        if (rm.lotId) {
          (lotIdToNames[rm.lotId] ||= []).push(rm.materialName);
        }
      }
    }
    for (const lotId of lotIds) {
      lotIdToNames[lotId] = [...new Set(lotIdToNames[lotId] || [])];
    }

    return shopProducts.map((p) => {
      const names: string[] = [];
      if (p.sourceStockId) {
        const name = stockIdToName.get(
          (p.sourceStockId as { toString(): string }).toString(),
        );
        if (name) names.push(name);
      }
      if (p.lotId && lotIdToNames[p.lotId]) {
        names.push(...lotIdToNames[p.lotId]);
      }
      const obj = p.toObject() as ShopProductDocument & {
        rawMaterialNames: string[];
      };
      obj.rawMaterialNames = [...new Set(names)];
      return obj;
    });
  }

  async getFilterOptions(): Promise<{
    shopBrands: Array<{ _id: string; name: string; code?: string }>;
    shopCategories: Array<{ _id: string; name: string; slug?: string }>;
    processors: string[];
    ssds: string[];
    rams: string[];
    gpuTypes: string[];
    gpuMemories: string[];
    displaySizes: string[];
    priceRange: { min: number; max: number };
    hasTouchScreen: boolean;
  }> {
    const query = { isActive: true, status: 'published' };

    const shopProducts = await this.shopProductModel
      .find(query)
      .select(
        'shopBrandId shopCategoryId price specs gpuType gpuMemory displaySize isTouchScreen',
      )
      .populate('shopBrandId', 'name code')
      .populate('shopCategoryId', 'name slug')
      .lean()
      .exec();

    const shopBrandMap = new Map<
      string,
      { _id: string; name: string; code?: string }
    >();
    const shopCategoryMap = new Map<
      string,
      { _id: string; name: string; slug?: string }
    >();
    const processors = new Set<string>();
    const ssds = new Set<string>();
    const rams = new Set<string>();
    const gpuTypes = new Set<string>();
    const gpuMemories = new Set<string>();
    const displaySizes = new Set<string>();

    let minPrice = Number.POSITIVE_INFINITY;
    let maxPrice = 0;
    let hasTouchScreen = false;

    for (const shopProduct of shopProducts) {
      const shopBrand = shopProduct.shopBrandId as any;
      if (shopBrand?._id && shopBrand?.name) {
        shopBrandMap.set(String(shopBrand._id), {
          _id: String(shopBrand._id),
          name: shopBrand.name,
          code: shopBrand.code,
        });
      }

      const shopCategory = shopProduct.shopCategoryId as any;
      if (shopCategory?._id && shopCategory?.name) {
        shopCategoryMap.set(String(shopCategory._id), {
          _id: String(shopCategory._id),
          name: shopCategory.name,
          slug: shopCategory.slug,
        });
      }

      if (typeof shopProduct.price === 'number') {
        minPrice = Math.min(minPrice, shopProduct.price);
        maxPrice = Math.max(maxPrice, shopProduct.price);
      }

      if ((shopProduct as any).isTouchScreen) hasTouchScreen = true;

      this.addOption(
        processors,
        shopProduct,
        [],
        ['processor', 'cpu', 'cpu model', 'processor model'],
      );
      this.addOption(
        ssds,
        shopProduct,
        [],
        ['ssd', 'storage', 'storage capacity'],
      );
      this.addOption(rams, shopProduct, [], ['ram', 'memory', 'system memory']);
      this.addOption(
        gpuTypes,
        shopProduct,
        ['gpuType'],
        ['gputype', 'gpu type', 'graphics type'],
      );
      this.addOption(
        gpuMemories,
        shopProduct,
        ['gpuMemory'],
        ['gpumemory', 'gpu memory', 'graphics memory', 'vram'],
      );
      this.addOption(
        displaySizes,
        shopProduct,
        ['displaySize'],
        ['display size', 'screen size', 'display'],
      );
    }

    return {
      shopBrands: this.sortOptions(
        new Set([...shopBrandMap.values()].map((shopBrand) => shopBrand.name)),
      ).map(
        (name) =>
          [...shopBrandMap.values()].find(
            (shopBrand) => shopBrand.name === name,
          )!,
      ),
      shopCategories: this.sortOptions(
        new Set(
          [...shopCategoryMap.values()].map(
            (shopCategory) => shopCategory.name,
          ),
        ),
      ).map(
        (name) =>
          [...shopCategoryMap.values()].find(
            (shopCategory) => shopCategory.name === name,
          )!,
      ),
      processors: this.sortOptions(processors),
      ssds: this.sortOptions(ssds),
      rams: this.sortOptions(rams),
      gpuTypes: this.sortOptions(gpuTypes),
      gpuMemories: this.sortOptions(gpuMemories),
      displaySizes: this.sortOptions(displaySizes),
      priceRange: {
        min: Number.isFinite(minPrice) ? minPrice : 0,
        max: maxPrice,
      },
      hasTouchScreen,
    };
  }

  /**
   * Find a single shopProduct by ID
   */
  async findById(
    id: string,
    options?: { includeUnpublished?: boolean },
  ): Promise<ShopProductDocument> {
    const cacheKey = `shopProducts:v1:byId:${id}`;
    const cacheable = !options?.includeUnpublished;
    if (cacheable) {
      const cached = await this.cache.get<ShopProductDocument>(cacheKey);
      if (cached) return cached;
    }

    const shopProduct = await this.shopProductModel
      .findById(id)
      .populate('shopBrandId', 'name code')
      .populate('shopCategoryId', 'name slug')
      .exec();

    if (!shopProduct) {
      throw new NotFoundException(`ShopProduct with ID ${id} not found`);
    }

    if (!options?.includeUnpublished && shopProduct.status !== 'published') {
      throw new NotFoundException(`ShopProduct with ID ${id} not found`);
    }

    if (cacheable) {
      await this.cache.set(cacheKey, shopProduct);
    }

    return shopProduct;
  }

  /**
   * Update a shopProduct
   */
  async update(
    id: string,
    dto: UpdateShopProductDto,
  ): Promise<ShopProductDocument> {
    const updateDto = dto as any; // Type assertion for partial DTO

    // If updating SKU, check for conflicts
    if (updateDto.sku) {
      const existing = await this.shopProductModel.findOne({
        sku: updateDto.sku,
        _id: { $ne: id },
      });
      if (existing) {
        throw new ConflictException(
          `ShopProduct with SKU ${updateDto.sku} already exists`,
        );
      }
    }

    // If updating shopBrandId, validate it exists
    if (updateDto.shopBrandId) {
      await this.shopBrandsService.findById(updateDto.shopBrandId);
    }

    // If updating shopCategoryId, validate it exists
    if (updateDto.shopCategoryId) {
      await this.shopCategoriesService.findById(updateDto.shopCategoryId);
    }

    // Check publish gate if updating status or sourceStockId
    if (
      updateDto.status === 'published' ||
      (updateDto.sourceStockId && updateDto.status !== 'pending')
    ) {
      const sourceStockId =
        updateDto.sourceStockId ||
        (await this.shopProductModel.findById(id))?.sourceStockId;
      if (!sourceStockId) {
        throw new BadRequestException(
          'sourceStockId is required to publish a shopProduct',
        );
      }
      const stock = await this.semiFinishedStockService.findOne(
        sourceStockId.toString(),
      );
      if (stock.status !== 'completed' && stock.status !== 'ready') {
        throw new BadRequestException(
          'Associated stock must be in completed or ready status to publish',
        );
      }
    }

    const updateData: any = { ...dto };
    if ('specs' in updateDto && updateDto.specs) {
      const existingShopProduct = await this.shopProductModel.findById(id);
      if (existingShopProduct) {
        updateData.specs = {
          ...((existingShopProduct as any).specs || {}),
          ...updateDto.specs,
        };
      }
    }

    const shopProduct = await this.shopProductModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('shopBrandId', 'name code')
      .populate('shopCategoryId', 'name slug')
      .exec();

    if (!shopProduct) {
      throw new NotFoundException(`ShopProduct with ID ${id} not found`);
    }

    await this.cache.delByPrefix('shopProducts:');
    return shopProduct;
  }

  private isAllowedImageUrl(raw: string): boolean {
    try {
      const u = new URL(raw);
      if (!['http:', 'https:'].includes(u.protocol)) return false;
      // Block private / loopback / metadata ranges
      const host = u.hostname.toLowerCase();
      if (['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(host))
        return false;
      if (
        host.startsWith('10.') ||
        host.startsWith('192.168.') ||
        host.startsWith('172.')
      ) {
        // Basic private range check — block 10/8, 192.168/16, 172.16/12
        if (host.startsWith('10.') || host.startsWith('192.168.')) return false;
        const second = parseInt(host.split('.')[1] || '0', 10);
        if (host.startsWith('172.') && second >= 16 && second <= 31)
          return false;
      }
      if (
        host === '169.254.169.254' ||
        host.endsWith('.internal') ||
        host.endsWith('.local')
      )
        return false;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Download external images from URLs and store them locally
   */
  async downloadExternalImages(
    shopProductId: string,
    imageUrls: string[],
  ): Promise<ShopProductDocument> {
    if (
      !Array.isArray(imageUrls) ||
      imageUrls.length === 0 ||
      imageUrls.length > 10
    ) {
      throw new BadRequestException('imageUrls must be an array of 1-10 URLs');
    }
    for (const u of imageUrls) {
      if (
        typeof u !== 'string' ||
        u.length > 2048 ||
        !this.isAllowedImageUrl(u)
      ) {
        throw new BadRequestException(`Blocked or invalid image URL: ${u}`);
      }
    }
    const shopProduct = await this.shopProductModel.findById(shopProductId);
    if (!shopProduct) {
      throw new NotFoundException(
        `ShopProduct with ID ${shopProductId} not found`,
      );
    }

    const storagePath = FileStorageUtil.getImageStoragePath();
    const localPaths: string[] = [];

    for (const imageUrl of imageUrls) {
      try {
        const response = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 8000,
          maxContentLength: 5 * 1024 * 1024,
          maxBodyLength: 5 * 1024 * 1024,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
          validateStatus: (s) => s >= 200 && s < 300,
        });

        const contentType = String(
          response.headers['content-type'] || 'image/jpeg',
        );
        if (!contentType.startsWith('image/')) {
          this.logger.warn(`URL does not point to an image: ${imageUrl}`);
          continue;
        }
        if (
          !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(
            contentType.split(';')[0].trim().toLowerCase(),
          )
        ) {
          this.logger.warn(`Unsupported image content-type: ${contentType}`);
          continue;
        }

        const ext =
          contentType.split('/').pop()?.split(';')[0]?.trim() || 'jpg';
        const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(
          ext.toLowerCase(),
        )
          ? ext.toLowerCase()
          : 'jpg';
        const filename = FileStorageUtil.generateUniqueFilename(
          `scraped.${safeExt}`,
        );
        const filePath = path.join(storagePath, filename);

        fs.writeFileSync(filePath, Buffer.from(response.data));
        localPaths.push(`/uploads/images/shopProducts/${filename}`);
      } catch (error: any) {
        this.logger.warn(
          `Failed to download image: ${imageUrl} - ${error.message}`,
        );
      }
    }

    if (localPaths.length === 0) {
      throw new BadRequestException(
        'Failed to download any images from the provided URLs',
      );
    }

    shopProduct.images.push(...localPaths);
    if (shopProduct.status === 'pending') {
      shopProduct.status = 'published';
    }
    await shopProduct.save();

    await this.cache.delByPrefix('shopProducts:');
    return shopProduct;
  }

  /**
   * Upload images for a shopProduct
   */
  async uploadImages(
    shopProductId: string,
    files: Express.Multer.File[],
  ): Promise<ShopProductDocument> {
    const shopProduct = await this.shopProductModel.findById(shopProductId);
    if (!shopProduct) {
      throw new NotFoundException(
        `ShopProduct with ID ${shopProductId} not found`,
      );
    }

    const storagePath = FileStorageUtil.getImageStoragePath();
    const imageUrls: string[] = [];

    // Save images and generate URLs
    for (const file of files) {
      this.assertAllowedMagicBytes(file.path, ['image']);
      const filename = FileStorageUtil.generateUniqueFilename(
        file.originalname,
      );
      const filePath = path.join(storagePath, filename);

      fs.renameSync(file.path, filePath);

      // Store relative path for URL
      imageUrls.push(`/uploads/images/shopProducts/${filename}`);
    }

    // Append to existing images
    shopProduct.images.push(...imageUrls);
    if (shopProduct.status === 'pending') {
      shopProduct.status = 'published';
    }
    await shopProduct.save();

    await this.cache.delByPrefix('shopProducts:');
    return shopProduct;
  }

  /**
   * Soft delete a shopProduct (set isActive to false)
   */
  async delete(id: string): Promise<void> {
    const shopProduct = await this.shopProductModel
      .findByIdAndDelete(id)
      .exec();

    if (!shopProduct) {
      throw new NotFoundException(`ShopProduct with ID ${id} not found`);
    }

    await this.cache.delByPrefix('shopProducts:');
    this.logger.log(`ShopProduct ${id} permanently deleted`);
  }

  /**
   * Find all shopProducts without pagination (for internal analytics use)
   */
  async findAllShopProducts(): Promise<ShopProductDocument[]> {
    return this.shopProductModel.find({ isActive: true }).exec();
  }

  /**
   * Atomically decrement stock for an offline/counter sale.
   *
   * Counter sales are allowed to oversell — a shop can bill an item it's
   * still waiting on a delivery for — so this deliberately has no stock-level
   * guard and will happily take `stock` negative.
   */
  async deductStock(
    productId: string,
    quantity: number,
  ): Promise<ShopProductDocument> {
    const shopProduct = await this.shopProductModel.findOneAndUpdate(
      { _id: productId },
      { $inc: { stock: -quantity } },
      { new: true },
    );

    if (!shopProduct) {
      throw new BadRequestException('Shop product not found');
    }

    await this.cache.delByPrefix('shopProducts:');
    return shopProduct;
  }

  /**
   * Atomically increment stock when a shop sale is reversed or deleted.
   */
  async incrementStock(
    productId: string,
    quantity: number,
  ): Promise<ShopProductDocument | null> {
    const updated = await this.shopProductModel.findOneAndUpdate(
      { _id: productId },
      { $inc: { stock: quantity } },
      { new: true },
    );
    await this.cache.delByPrefix('shopProducts:');
    return updated;
  }
}
