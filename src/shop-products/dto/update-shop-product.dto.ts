import { PartialType } from '@nestjs/mapped-types';
import { CreateShopProductDto } from './create-shop-product.dto';

export class UpdateShopProductDto extends PartialType(CreateShopProductDto) {}
