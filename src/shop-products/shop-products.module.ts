import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { ScheduleModule } from '@nestjs/schedule';
import { ShopProduct, ShopProductSchema } from './schemas/shop-product.schema';
import { ShopBrand, ShopBrandSchema } from './schemas/shop-brand.schema';
import {
  ExcelUploadHistory,
  ExcelUploadHistorySchema,
} from './schemas/excel-upload-history.schema';
import {
  ScrapedShopProduct,
  ScrapedShopProductSchema,
} from './schemas/scraped-shop-product.schema';
import {
  RawMaterial,
  RawMaterialSchema,
} from '../manufacturing/raw-materials/schemas/raw-material.schema';
import {
  SemiFinishedStock,
  SemiFinishedStockSchema,
} from '../manufacturing/semi-finished-stock/schemas/semi-finished-stock.schema';
import { ShopProductsService } from './services/shop-products.service';
import { ShopBrandsService } from './services/shop-brands.service';
import { ExcelCleanupService } from './services/excel-cleanup.service';
import { ShopProductsController } from './controllers/shop-products.controller';
import { ShopBrandsController } from './controllers/shop-brands.controller';
import { ExcelCleanupCron } from './cron/excel-cleanup.cron';
import { ShopCategoriesModule } from '../shop-categories/shop-categories.module';
import { SemiFinishedStockModule } from '../manufacturing/semi-finished-stock/semi-finished-stock.module';
import { ManagersModule } from '../managers/managers.module';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShopProduct.name, schema: ShopProductSchema },
      { name: ShopBrand.name, schema: ShopBrandSchema },
      { name: ExcelUploadHistory.name, schema: ExcelUploadHistorySchema },
      { name: ScrapedShopProduct.name, schema: ScrapedShopProductSchema },
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
    ShopCategoriesModule,
    SemiFinishedStockModule,
    ManagersModule,
  ],
  controllers: [ShopProductsController, ShopBrandsController],
  providers: [
    ShopProductsService,
    ShopBrandsService,
    ExcelCleanupService,
    ExcelCleanupCron,
  ],
  exports: [ShopProductsService, ShopBrandsService],
})
export class ShopProductsModule {}
