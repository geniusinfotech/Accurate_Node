import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { Product, ProductSchema } from './schemas/product.schema';
import { Brand, BrandSchema } from './schemas/brand.schema';
import { ProductsService } from './services/products.service';
import { BrandsService } from './services/brands.service';
import { ProductsController } from './controllers/products.controller';
import { BrandsController } from './controllers/brands.controller';
import { CategoriesModule } from '../categories/categories.module';
import { ManagersModule } from '../managers/managers.module';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Brand.name, schema: BrandSchema },
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
        fileSize: 10 * 1024 * 1024,
      },
    }),
    CategoriesModule,
    ManagersModule,
  ],
  controllers: [ProductsController, BrandsController],
  providers: [
    ProductsService,
    BrandsService,
  ],
  exports: [ProductsService, BrandsService],
})
export class ProductsModule {}