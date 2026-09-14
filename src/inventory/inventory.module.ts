import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { InventoryService } from './inventory.service';
import { InventoryGateway } from './events/inventory.gateway';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
  ],
  providers: [InventoryService, InventoryGateway],
  exports: [InventoryService],
})
export class InventoryModule {}
