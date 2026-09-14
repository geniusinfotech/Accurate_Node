import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  Request,
  Logger,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as path from 'path';
import * as fs from 'fs';
import { ShopProductsService } from '../services/shop-products.service';
import { ShopBrandsService } from '../services/shop-brands.service';
import { CreateShopProductDto } from '../dto/create-shop-product.dto';
import { UpdateShopProductDto } from '../dto/update-shop-product.dto';
import { ExcelUploadDto } from '../dto/excel-upload.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Roles } from '../../auth/roles.decorator';
import { Permissions } from '../../auth/permissions.decorator';
import { Role } from '../../auth/roles.enum';
import { Permission } from '../../auth/permissions.enum';
import { OptionalJwtAuthGuard } from '../../auth/optional-jwt-auth.guard';
import { excelUploadOptions } from '../interceptors/excel-upload.interceptor';
import { imagesUploadOptions } from '../interceptors/images-upload.interceptor';
import { Throttle } from '@nestjs/throttler';
import { ShopCategoriesService } from '../../shop-categories/shop-categories.service';

@Controller('shop-products')
export class ShopProductsController {
  constructor(
    private readonly shopProductsService: ShopProductsService,
    private readonly shopBrandsService: ShopBrandsService,
    private readonly shopCategoriesService: ShopCategoriesService,
  ) {}

  private hasCatalogAccess(user?: { roles?: Role[] }): boolean {
    return !!user?.roles?.some((role) =>
      [Role.ADMIN, Role.MANAGER].includes(role),
    );
  }

  /**
   * Create a new shopProduct manually (Admin only)
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.PRODUCTS_ADD)
  async create(@Body() dto: CreateShopProductDto) {
    return this.shopProductsService.create(dto);
  }

  /**
   * Create shopProduct with image upload (Admin only)
   */
  @Post('with-image')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.PRODUCTS_ADD)
  @UseInterceptors(
    FilesInterceptor('image', 10, {
      storage: diskStorage({
        destination: './uploads/temp',
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `shopProduct-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        const allowedMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
        ];
        if (
          !file.originalname.match(/\.(jpg|jpeg|png|webp|gif)$/i) ||
          !allowedMimeTypes.includes(file.mimetype)
        ) {
          return callback(
            new BadRequestException('Only image files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024, files: 10 },
    }),
  )
  async createWithImage(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: any,
  ) {
    const name =
      typeof body.name === 'string' ? body.name.trim().slice(0, 500) : '';
    const price = parseFloat(body.price);
    const stock = parseInt(body.stock, 10);
    const description =
      typeof body.description === 'string'
        ? body.description.slice(0, 5000)
        : '';
    const material =
      typeof body.material === 'string' ? body.material.slice(0, 200) : '';

    if (
      !name ||
      !Number.isFinite(price) ||
      price <= 0 ||
      price > 9999999 ||
      !Number.isInteger(stock) ||
      stock < 0 ||
      stock > 999999
    ) {
      throw new BadRequestException('Invalid name, price, or stock');
    }

    let shopBrandId = body.shopBrandId;
    if (
      !shopBrandId ||
      shopBrandId === '000000000000000000000000' ||
      !/^[a-fA-F0-9]{24}$/.test(String(shopBrandId))
    ) {
      const existing: any[] = await this.shopBrandsService.findAll({
        isActive: true,
      });
      shopBrandId =
        existing.length > 0
          ? existing[0]._id.toString()
          : (
              await this.shopBrandsService.create({
                name: 'Glitera',
                code: 'LUMIERE',
              })
            )._id.toString();
    }

    let shopCategoryId = body.shopCategoryId;
    if (
      !shopCategoryId ||
      shopCategoryId === '000000000000000000000000' ||
      !/^[a-fA-F0-9]{24}$/.test(String(shopCategoryId))
    ) {
      const existing: any[] = await this.shopCategoriesService.findAll();
      shopCategoryId =
        existing.length > 0
          ? existing[0]._id?.toString() || existing[0].id
          : (
              (await this.shopCategoriesService.create({
                name: 'General',
                slug: 'general',
              } as any)) as any
            )._id.toString();
    }

    const imageUrls: string[] = [];
    if (files && files.length > 0) {
      const storageDir = './uploads/images/shopProducts';
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      for (const file of files) {
        // Validate magic bytes before promoting from temp
        try {
          const buf = Buffer.alloc(12);
          const fd = fs.openSync(file.path, 'r');
          try {
            fs.readSync(fd, buf, 0, 12, 0);
          } finally {
            fs.closeSync(fd);
          }
          const hex = buf.toString('hex');
          const isImg =
            hex.startsWith('ffd8ff') ||
            hex.startsWith('89504e47') ||
            hex.startsWith('47494638') ||
            (buf.slice(0, 4).toString('ascii') === 'RIFF' &&
              buf.slice(8, 12).toString('ascii') === 'WEBP');
          if (!isImg) {
            fs.unlinkSync(file.path);
            continue;
          }
        } catch {
          try {
            fs.unlinkSync(file.path);
          } catch {}
          continue;
        }
        const filename = `shopProduct-${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname).toLowerCase()}`;
        const destPath = path.join(storageDir, filename);
        fs.renameSync(file.path, destPath);
        imageUrls.push(`/uploads/images/shopProducts/${filename}`);
      }
    }

    const dto = new CreateShopProductDto();
    dto.name = name;
    dto.price = price;
    dto.stock = stock;
    dto.description = description;
    dto.images = imageUrls;
    dto.shopBrandId = shopBrandId;
    dto.shopCategoryId = shopCategoryId;
    dto.status = body.sourceStockId ? 'published' : 'pending';
    dto.sku = body.sku;
    if (body.mrp) dto.mrp = parseFloat(body.mrp);
    if (body.purchaseRate) dto.purchaseRate = parseFloat(body.purchaseRate);
    if (body.discountPercent !== undefined)
      dto.discountPercent = parseFloat(body.discountPercent);
    if (body.reservedStock !== undefined)
      dto.reservedStock = parseInt(body.reservedStock, 10);
    if (body.discount !== undefined) dto.discount = parseFloat(body.discount);
    if (body.tags)
      dto.tags =
        typeof body.tags === 'string'
          ? body.tags.split(',').map((t: string) => t.trim())
          : body.tags;
    if (body.isFeatured !== undefined)
      dto.isFeatured = body.isFeatured === 'true' || body.isFeatured === true;
    if (body.isNewArrival !== undefined)
      dto.isNewArrival =
        body.isNewArrival === 'true' || body.isNewArrival === true;
    if (body.isBestseller !== undefined)
      dto.isBestseller =
        body.isBestseller === 'true' || body.isBestseller === true;
    if (body.isCombo !== undefined)
      dto.isCombo = body.isCombo === 'true' || body.isCombo === true;
    if (body.isPremium !== undefined)
      dto.isPremium = body.isPremium === 'true' || body.isPremium === true;
    if (body.isHypoallergenic !== undefined)
      dto.isHypoallergenic =
        body.isHypoallergenic === 'true' || body.isHypoallergenic === true;
    if (body.closureType) dto.closureType = body.closureType;
    if (body.warranty) dto.warranty = body.warranty;
    if (body.careInstructions) dto.careInstructions = body.careInstructions;
    if (body.occasion)
      dto.occasion =
        typeof body.occasion === 'string'
          ? body.occasion
              .split(',')
              .map((o: string) => o.trim())
              .filter(Boolean)
          : body.occasion;
    if (body.slug) dto.slug = body.slug;
    if (body.sourceStockId) dto.sourceStockId = body.sourceStockId;
    if (body.videoUrl) dto.videoUrl = body.videoUrl;
    if (material) dto.material = { baseMetal: material } as any;

    return this.shopProductsService.create(dto);
  }

  /**
   * Bulk upload shopProducts from Excel (Admin only)
   * Rate limited to 10 requests per hour
   */
  @Post('upload-excel')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.PRODUCTS_ADD)
  @Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10 requests per hour
  @UseInterceptors(FileInterceptor('file', excelUploadOptions))
  async uploadExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ExcelUploadDto,
    @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException('Excel file is required');
    }

    const userId = req.user.userId || req.user.sub;
    return this.shopProductsService.bulkUploadFromExcel(
      file,
      dto.shopBrandId,
      dto.shopCategoryId,
      userId,
    );
  }

  /**
   * Download and store external images for a shopProduct (Admin only)
   */
  @Post(':id/external-images')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.PRODUCTS_ADD)
  async downloadExternalImages(
    @Param('id') id: string,
    @Body('imageUrls') imageUrls: string[],
  ) {
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      throw new BadRequestException('imageUrls array is required');
    }
    return this.shopProductsService.downloadExternalImages(id, imageUrls);
  }

  /**
   * Upload images for a shopProduct (Admin only)
   */
  @Put(':id/images')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.PRODUCTS_ADD)
  @UseInterceptors(FilesInterceptor('images', 10, imagesUploadOptions))
  async uploadImages(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one image is required');
    }

    return this.shopProductsService.uploadImages(id, files);
  }

  /**
   * Update a shopProduct (Admin only)
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.PRODUCTS_EDIT)
  async update(@Param('id') id: string, @Body() dto: UpdateShopProductDto) {
    return this.shopProductsService.update(id, dto);
  }

  /**
   * Get all shopProducts with filters and pagination
   */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('shopBrandId') shopBrandId?: string,
    @Query('shopCategoryId') shopCategoryId?: string,
    @Query('isActive') isActive?: string,
    @Query('status') status?: string,
    @Query('includeUnpublished') includeUnpublished?: string,
    @Query('search') search?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('processor') processor?: string,
    @Query('ssd') ssd?: string,
    @Query('ram') ram?: string,
    @Query('gpuType') gpuType?: string,
    @Query('gpuMemory') gpuMemory?: string,
    @Query('displaySize') displaySize?: string,
    @Query('isTouchScreen') isTouchScreen?: string,
    @Query('isPremium') isPremium?: string,
    @Query('sort') sort?: string,
    @Request() req?,
  ) {
    const isPrivilegedUser = this.hasCatalogAccess(req.user);
    let pageNum = page ? parseInt(String(page), 10) : 1;
    let limitNum = limit ? parseInt(String(limit), 10) : 12;
    if (!Number.isInteger(pageNum) || pageNum < 1) pageNum = 1;
    if (!Number.isInteger(limitNum) || limitNum < 1) limitNum = 12;
    if (limitNum > 50) limitNum = 50;
    if (pageNum > 1000) pageNum = 1000;
    const filters: any = { page: pageNum, limit: limitNum };
    const allowedSorts = ['price_asc', 'price_desc', 'newest', 'rating'];
    if (sort && !allowedSorts.includes(String(sort))) {
      throw new BadRequestException('Invalid sort value');
    }

    if (shopBrandId) filters.shopBrandId = shopBrandId;
    if (shopCategoryId) filters.shopCategoryId = shopCategoryId;
    if (isPremium !== undefined) filters.isPremium = isPremium === 'true';
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (status === 'published') filters.status = 'published';
    if (
      isPrivilegedUser &&
      status &&
      ['pending', 'published'].includes(status)
    ) {
      filters.status = status;
    }
    if (isPrivilegedUser && includeUnpublished === 'true') {
      filters.includeUnpublished = true;
    }
    if (search) {
      const s = String(search).trim().slice(0, 100);
      if (s) filters.search = s;
    }
    if (minPrice !== undefined) {
      const v = parseFloat(String(minPrice));
      if (!Number.isFinite(v) || v < 0 || v > 10000000)
        throw new BadRequestException('Invalid minPrice');
      filters.minPrice = v;
    }
    if (maxPrice !== undefined) {
      const v = parseFloat(String(maxPrice));
      if (!Number.isFinite(v) || v < 0 || v > 10000000)
        throw new BadRequestException('Invalid maxPrice');
      filters.maxPrice = v;
    }
    if (
      filters.minPrice !== undefined &&
      filters.maxPrice !== undefined &&
      filters.minPrice > filters.maxPrice
    ) {
      throw new BadRequestException('minPrice cannot exceed maxPrice');
    }
    if (processor) filters.processor = processor;
    if (ssd) filters.ssd = ssd;
    if (ram) filters.ram = ram;
    if (gpuType) filters.gpuType = gpuType;
    if (gpuMemory) filters.gpuMemory = gpuMemory;
    if (displaySize) filters.displaySize = displaySize;
    if (isTouchScreen !== undefined)
      filters.isTouchScreen = isTouchScreen === 'true';
    if (sort) filters.sort = sort;

    return this.shopProductsService.findAll(filters);
  }

  /**
   * Get filter values derived from active published shopProducts
   */
  @Get('filter-options')
  async getFilterOptions() {
    return this.shopProductsService.getFilterOptions();
  }

  /**
   * Get a single shopProduct by ID
   */
  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async findById(
    @Param('id') id: string,
    @Query('includeUnpublished') includeUnpublished?: string,
    @Request() req?,
  ) {
    return this.shopProductsService.findById(id, {
      includeUnpublished:
        this.hasCatalogAccess(req.user) && includeUnpublished === 'true',
    });
  }

  /**
   * Soft delete a shopProduct (Admin only)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.PRODUCTS_DELETE)
  async delete(@Param('id') id: string) {
    await this.shopProductsService.delete(id);
    return { message: 'ShopProduct deleted successfully' };
  }
}
