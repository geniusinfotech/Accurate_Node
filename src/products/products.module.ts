import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { ScheduleModule } from '@nestjs/schedule';
import { Product, ProductSchema } from './schemas/product.schema';
import { Brand, BrandSchema } from './schemas/brand.schema';
import {
  ExcelUploadHistory,
  ExcelUploadHistorySchema,
} from './schemas/excel-upload-history.schema';
import {
  ScrapedProduct,
  ScrapedProductSchema,
} from './schemas/scraped-product.schema';
import {
  RawMaterial,
  RawMaterialSchema,
} from '../manufacturing/raw-materials/schemas/raw-material.schema';
import {
  SemiFinishedStock,
  SemiFinishedStockSchema,
} from '../manufacturing/semi-finished-stock/schemas/semi-finished-stock.schema';
import { ProductsService } from './services/products.service';
import { BrandsService } from './services/brands.service';
import { ExcelCleanupService } from './services/excel-cleanup.service';
import { ProductsController } from './controllers/products.controller';
import { BrandsController } from './controllers/brands.controller';
import { ExcelCleanupCron } from './cron/excel-cleanup.cron';
import { CategoriesModule } from '../categories/categories.module';
import { SemiFinishedStockModule } from '../manufacturing/semi-finished-stock/semi-finished-stock.module';
import { ManagersModule } from '../managers/managers.module';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Brand.name, schema: BrandSchema },
      { name: ExcelUploadHistory.name, schema: ExcelUploadHistorySchema },
      { name: ScrapedProduct.name, schema: ScrapedProductSchema },
      { name: RawMaterial.name, schema: RawMaterialSchema },
      { name: SemiFinishedStock.name, schema: SemiFinishedStockSchema },
    ]),
    MulterModule.register({
      storage: diskStorage({
        destination: (req, file, callback) => {
          const tempDir = './uploads/temp';
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          callback(null, tempDir);
        },
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `upload-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        const allowedTypes = /\.(jpg|jpeg|png|gif|xlsx|xls|webp)$/i;
        if (!file.originalname.match(allowedTypes)) {
          return callback(new Error('Invalid file type'), false);
        }
        callback(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
    ScheduleModule.forRoot(),
    CategoriesModule,
    SemiFinishedStockModule,
    ManagersModule,
  ],
  controllers: [ProductsController, BrandsController],
  providers: [
    ProductsService,
    BrandsService,
    ExcelCleanupService,
    ExcelCleanupCron,
  ],
  exports: [ProductsService, BrandsService],
})
export class ProductsModule {}
