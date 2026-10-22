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
import { CreateProductDto, PRODUCT_TYPES } from '../dto/create-product.dto';

const MAX_IMPORT_ROWS = 500;

/** User text in a $regex must match literally (no regex injection / ReDoS). */
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
import { UpdateProductDto } from '../dto/update-product.dto';
import { BrandsService } from './brands.service';
import { CategoriesService } from '../../categories/categories.service';
import { assertFetchableUrl, untrustedFetchOptions } from '../../common/utils/safe-http.util';
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
        { name: { $regex: escapeRegex(search), $options: 'i' } },
        { sku: { $regex: escapeRegex(search), $options: 'i' } },
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

    for (const rawUrl of imageUrls) {
      try {
        if (typeof rawUrl !== 'string' || !rawUrl.trim()) continue;
        const parsed = assertFetchableUrl(rawUrl.trim()); // http(s) only, no internal hosts (SSRF)

        const response = await axios.get(parsed.toString(), {
          responseType: 'arraybuffer',
          timeout: 10000,
          maxContentLength: 10 * 1024 * 1024,
          ...untrustedFetchOptions(), // re-checks the resolved IP on connect; no redirects
        });

        const contentType = Array.isArray(response.headers['content-type'])
          ? response.headers['content-type'][0]
          : response.headers['content-type'];
        const contentTypeStr = typeof contentType === 'string' ? contentType.toLowerCase() : '';
        if (!contentTypeStr.startsWith('image/')) {
          this.logger.warn(`Rejected non-image payload from ${rawUrl} (content-type: ${contentTypeStr})`);
          continue;
        }

        const ext = contentTypeStr.includes('png') ? '.png' : contentTypeStr.includes('webp') ? '.webp' : '.jpg';
        const filename = `product-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        const destPath = path.join(uploadDir, filename);
        const buffer = Buffer.from(response.data);
        fs.writeFileSync(destPath, buffer);
        downloadedUrls.push(`/uploads/images/products/${filename}`);
      } catch (error: any) {
        this.logger.error(`Failed to download image from ${rawUrl}: ${error?.message || error}`);
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

  /**
   * Imports products from an .xlsx sheet (see buildImportTemplate). Columns are
   * found by header name, so their order does not matter. Rows whose SKU already
   * exists update that product's name, price, stock (and MRP / description when
   * filled in); every other row creates a published product.
   */
  async bulkUploadFromExcel(
    file: Express.Multer.File,
    brandId: string | undefined,
    categoryId: string,
  ): Promise<{ created: number; updated: number; errors: string[] }> {
    await this.categoriesService.findById(categoryId);
    if (brandId) await this.brandsService.findById(brandId);

    const workbook = new ExcelJS.Workbook();
    const buffer = file.buffer ?? (await fs.promises.readFile(file.path));
    try {
      await workbook.xlsx.load(buffer as any);
    } catch {
      throw new BadRequestException('Could not read the file. Use the .xlsx template.');
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('The workbook has no sheets.');
    if (sheet.rowCount > MAX_IMPORT_ROWS + 1) {
      throw new BadRequestException(`Too many rows. Import at most ${MAX_IMPORT_ROWS} at a time.`);
    }

    const text = (cell: ExcelJS.Cell) => (cell?.text ?? '').toString().trim();
    const column: Record<string, number> = {};
    sheet.getRow(1).eachCell((cell, n) => {
      column[text(cell).toLowerCase().replace(/[^a-z]/g, '')] = n;
    });
    if (!column.name || !column.price) {
      throw new BadRequestException('The sheet needs "Name" and "Price" columns. Download the template.');
    }

    const results = { created: 0, updated: 0, errors: [] as string[] };
    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const get = (key: string) => (column[key] ? text(row.getCell(column[key])) : '');
      const number = (key: string) => Number(get(key).replace(/[₹,\s]/g, ''));

      const name = get('name');
      if (!name && !get('price')) continue; // blank line
      const price = number('price');
      const stock = get('stock') ? number('stock') : 0;
      const mrp = get('mrp') ? number('mrp') : undefined;
      if (!name || !(price >= 0) || get('price') === '' || !Number.isInteger(stock) || stock < 0) {
        results.errors.push(`Row ${r}: needs a name, a price and a whole-number stock (0 or more)`);
        continue;
      }
      const sku = (get('sku') || `${name.replace(/[^A-Za-z0-9]+/g, '-').slice(0, 20)}-${r}-${Date.now().toString(36).slice(-4)}`).toUpperCase();
      const description = get('description');
      const type = get('producttype').toLowerCase().replace(/[\s-]+/g, '_');

      try {
        const existing = await this.productModel.findOne({ sku }).exec();
        if (existing) {
          existing.name = name;
          existing.price = price;
          existing.stock = stock;
          if (mrp !== undefined) existing.mrp = mrp;
          if (description) existing.description = description;
          await existing.save();
          results.updated++;
        } else {
          await this.productModel.create({
            name,
            sku,
            price,
            mrp,
            stock,
            description,
            categoryId,
            ...(brandId ? { brandId } : {}),
            productType: PRODUCT_TYPES.includes(type) ? type : 'other',
            status: 'published',
            isActive: true,
          });
          results.created++;
        }
      } catch (error) {
        results.errors.push(`Row ${r}: ${error.message}`);
      }
    }
    if (file.path) await fs.promises.unlink(file.path).catch(() => undefined);
    return results;
  }

  /** The sheet admins fill in for bulk import. */
  async buildImportTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Products');
    sheet.columns = [
      { header: 'Name', key: 'name', width: 38 },
      { header: 'SKU', key: 'sku', width: 18 },
      { header: 'Price', key: 'price', width: 10 },
      { header: 'MRP', key: 'mrp', width: 10 },
      { header: 'Stock', key: 'stock', width: 10 },
      { header: 'Description', key: 'description', width: 50 },
      { header: 'Product type', key: 'producttype', width: 22 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.addRow({
      name: 'Accurate Dishwash Gel 500 ml',
      sku: 'ACC-DW-500',
      price: 99,
      mrp: 120,
      stock: 100,
      description: 'Cuts grease fast, gentle on hands.',
      producttype: 'dishwash',
    });
    const help = workbook.addWorksheet('How to fill');
    [
      ['Required: Name, Price. Everything else is optional.'],
      ['SKU: leave empty to generate one. An existing SKU updates that product instead of creating a new one.'],
      ['Stock: whole number, empty means 0. MRP: the crossed-out price, optional.'],
      ['Imported products are published straight away. Add photos afterwards by editing each product.'],
      ['Product type must be one of: ' + PRODUCT_TYPES.join(', ') + ' (anything else becomes "other").'],
    ].forEach((line) => help.addRow(line));
    help.getColumn(1).width = 120;
    return Buffer.from(await workbook.xlsx.writeBuffer());
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