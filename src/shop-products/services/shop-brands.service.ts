import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ShopBrand, ShopBrandDocument } from '../schemas/shop-brand.schema';
import { CreateShopBrandDto } from '../dto/create-shop-brand.dto';

@Injectable()
export class ShopBrandsService {
  constructor(
    @InjectModel(ShopBrand.name)
    private shopBrandModel: Model<ShopBrandDocument>,
  ) {}

  /**
   * Create a new shopBrand
   */
  async create(dto: CreateShopBrandDto): Promise<ShopBrandDocument> {
    // Check if shopBrand with same name exists
    const existingByName = await this.shopBrandModel.findOne({
      name: new RegExp(`^${dto.name}$`, 'i'),
    });
    if (existingByName) {
      throw new ConflictException('ShopBrand with this name already exists');
    }

    // Check if shopBrand with same code exists
    const existingByCode = await this.shopBrandModel.findOne({
      code: dto.code.toUpperCase(),
    });
    if (existingByCode) {
      throw new ConflictException('ShopBrand with this code already exists');
    }

    const shopBrand = new this.shopBrandModel({
      ...dto,
      code: dto.code.toUpperCase(),
    });

    return shopBrand.save();
  }

  /**
   * Find all shopBrands with optional filters
   */
  async findAll(filters?: {
    isActive?: boolean;
  }): Promise<ShopBrandDocument[]> {
    const query =
      filters?.isActive !== undefined ? { isActive: filters.isActive } : {};

    return this.shopBrandModel.find(query).sort({ name: 1 }).exec();
  }

  /**
   * Find a single shopBrand by ID
   */
  async findById(id: string): Promise<ShopBrandDocument> {
    const shopBrand = await this.shopBrandModel.findById(id).exec();
    if (!shopBrand) {
      throw new NotFoundException(`ShopBrand with ID ${id} not found`);
    }
    return shopBrand;
  }

  /**
   * Update a shopBrand
   */
  async update(
    id: string,
    updateData: Partial<CreateShopBrandDto>,
  ): Promise<ShopBrandDocument> {
    // If updating name, check for conflicts
    if (updateData.name) {
      const existing = await this.shopBrandModel.findOne({
        name: new RegExp(`^${updateData.name}$`, 'i'),
        _id: { $ne: id },
      });
      if (existing) {
        throw new ConflictException('ShopBrand with this name already exists');
      }
    }

    // If updating code, check for conflicts
    if (updateData.code) {
      const existing = await this.shopBrandModel.findOne({
        code: updateData.code.toUpperCase(),
        _id: { $ne: id },
      });
      if (existing) {
        throw new ConflictException('ShopBrand with this code already exists');
      }
      updateData.code = updateData.code.toUpperCase();
    }

    const shopBrand = await this.shopBrandModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();

    if (!shopBrand) {
      throw new NotFoundException(`ShopBrand with ID ${id} not found`);
    }

    return shopBrand;
  }

  /**
   * Toggle shopBrand active status
   */
  async toggleActive(
    id: string,
    isActive: boolean,
  ): Promise<ShopBrandDocument> {
    const shopBrand = await this.shopBrandModel
      .findByIdAndUpdate(id, { isActive }, { new: true })
      .exec();

    if (!shopBrand) {
      throw new NotFoundException(`ShopBrand with ID ${id} not found`);
    }

    return shopBrand;
  }
}
