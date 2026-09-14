import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Brand, BrandDocument } from '../schemas/brand.schema';
import { CreateBrandDto } from '../dto/create-brand.dto';

@Injectable()
export class BrandsService {
  constructor(
    @InjectModel(Brand.name) private brandModel: Model<BrandDocument>,
  ) {}

  /**
   * Create a new brand
   */
  async create(dto: CreateBrandDto): Promise<BrandDocument> {
    // Check if brand with same name exists
    const existingByName = await this.brandModel.findOne({
      name: new RegExp(`^${dto.name}$`, 'i'),
    });
    if (existingByName) {
      throw new ConflictException('Brand with this name already exists');
    }

    // Check if brand with same code exists
    const existingByCode = await this.brandModel.findOne({
      code: dto.code.toUpperCase(),
    });
    if (existingByCode) {
      throw new ConflictException('Brand with this code already exists');
    }

    const brand = new this.brandModel({
      ...dto,
      code: dto.code.toUpperCase(),
    });

    return brand.save();
  }

  /**
   * Find all brands with optional filters
   */
  async findAll(filters?: { isActive?: boolean }): Promise<BrandDocument[]> {
    const query =
      filters?.isActive !== undefined ? { isActive: filters.isActive } : {};

    return this.brandModel.find(query).sort({ name: 1 }).exec();
  }

  /**
   * Find a single brand by ID
   */
  async findById(id: string): Promise<BrandDocument> {
    const brand = await this.brandModel.findById(id).exec();
    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }
    return brand;
  }

  /**
   * Update a brand
   */
  async update(
    id: string,
    updateData: Partial<CreateBrandDto>,
  ): Promise<BrandDocument> {
    // If updating name, check for conflicts
    if (updateData.name) {
      const existing = await this.brandModel.findOne({
        name: new RegExp(`^${updateData.name}$`, 'i'),
        _id: { $ne: id },
      });
      if (existing) {
        throw new ConflictException('Brand with this name already exists');
      }
    }

    // If updating code, check for conflicts
    if (updateData.code) {
      const existing = await this.brandModel.findOne({
        code: updateData.code.toUpperCase(),
        _id: { $ne: id },
      });
      if (existing) {
        throw new ConflictException('Brand with this code already exists');
      }
      updateData.code = updateData.code.toUpperCase();
    }

    const brand = await this.brandModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    return brand;
  }

  /**
   * Toggle brand active status
   */
  async toggleActive(id: string, isActive: boolean): Promise<BrandDocument> {
    const brand = await this.brandModel
      .findByIdAndUpdate(id, { isActive }, { new: true })
      .exec();

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    return brand;
  }
}
