import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShopCategoriesService } from './shop-categories.service';
import { ShopCategoriesController } from './shop-categories.controller';
import {
  ShopCategory,
  ShopCategorySchema,
} from './schemas/shop-category.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShopCategory.name, schema: ShopCategorySchema },
    ]),
  ],
  controllers: [ShopCategoriesController],
  providers: [ShopCategoriesService],
  exports: [ShopCategoriesService],
})
export class ShopCategoriesModule {}
