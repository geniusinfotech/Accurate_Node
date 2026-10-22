import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Customer, CustomerDocument } from './schemas/customer.schema';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
  ) {}

  async findOrCreate(name: string, phone: string): Promise<CustomerDocument> {
    const cleanPhone = (phone ?? '').trim().replace(/\s+/g, '');
    const cleanName = (name ?? '').trim();

    if (!cleanName || !cleanPhone) {
      throw new BadRequestException('Customer name and phone are required');
    }

    let customer = await this.customerModel
      .findOne({ name: cleanName, phone: cleanPhone })
      .exec();

    if (!customer) {
      customer = await this.customerModel.create({
        name: cleanName,
        phone: cleanPhone,
        address: '',
        gstin: '',
        notes: '',
      });
    }

    return customer;
  }

  async create(
    createCustomerDto: CreateCustomerDto,
  ): Promise<CustomerDocument> {
    const cleanPhone = createCustomerDto.phone.trim().replace(/\s+/g, '');
    const cleanName = createCustomerDto.name.trim();

    const existing = await this.customerModel
      .findOne({ name: cleanName, phone: cleanPhone })
      .exec();

    if (existing) {
      throw new BadRequestException(
        'Customer with this name and phone already exists',
      );
    }

    const created = new this.customerModel({
      ...createCustomerDto,
      name: cleanName,
      phone: cleanPhone,
    });

    return created.save();
  }

  async findAll(
    query: {
      page?: number;
      limit?: number;
      search?: string;
    } = {},
  ): Promise<{
    items: CustomerDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.search) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ name: regex }, { phone: regex }, { gstin: regex }];
    }

    const [items, total] = await Promise.all([
      this.customerModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.customerModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<CustomerDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid customer ID');
    }
    const customer = await this.customerModel.findById(id).exec();
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }
    return customer;
  }

  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto,
  ): Promise<CustomerDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid customer ID');
    }

    const updateData: any = { ...updateCustomerDto };
    if (updateData.phone) {
      updateData.phone = updateData.phone.trim().replace(/\s+/g, '');
    }
    if (updateData.name) {
      updateData.name = updateData.name.trim();
    }

    const updated = await this.customerModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }
    return updated;
  }

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid customer ID');
    }
    const result = await this.customerModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }
    return { success: true, message: 'Customer deleted successfully' };
  }
}
