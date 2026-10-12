import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Contact, ContactDocument, ContactStatus } from './schemas/contact.schema';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactStatusDto } from './dto/update-contact.dto';

@Injectable()
export class ContactService {
  constructor(
    @InjectModel(Contact.name)
    private readonly contactModel: Model<ContactDocument>,
  ) {}

  async create(dto: CreateContactDto): Promise<ContactDocument> {
    const cleanPhone = dto.phone.trim().replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      throw new BadRequestException(
        'Phone number must start with 6, 7, 8, or 9 and be exactly 10 digits',
      );
    }

    const contact = new this.contactModel({
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: cleanPhone,
      subject: dto.subject?.trim() || 'General Inquiry',
      message: dto.message.trim(),
      status: ContactStatus.UNREAD,
    });

    return contact.save();
  }

  async findAll(
    status?: string,
    search?: string,
    page = 1,
    limit = 50,
  ): Promise<{
    items: ContactDocument[];
    total: number;
    unreadCount: number;
    page: number;
    totalPages: number;
  }> {
    const filter: any = {};

    if (status && Object.values(ContactStatus).includes(status as ContactStatus)) {
      filter.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { subject: { $regex: q, $options: 'i' } },
        { message: { $regex: q, $options: 'i' } },
      ];
    }

    const skip = Math.max(0, (page - 1) * limit);
    const [items, total, unreadCount] = await Promise.all([
      this.contactModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.contactModel.countDocuments(filter).exec(),
      this.contactModel.countDocuments({ status: ContactStatus.UNREAD }).exec(),
    ]);

    return {
      items,
      total,
      unreadCount,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findById(id: string): Promise<ContactDocument> {
    const contact = await this.contactModel.findById(id).exec();
    if (!contact) {
      throw new NotFoundException('Contact message not found');
    }
    return contact;
  }

  async updateStatus(
    id: string,
    dto: UpdateContactStatusDto,
  ): Promise<ContactDocument> {
    const update: any = { status: dto.status };
    if (dto.notes !== undefined) {
      update.notes = dto.notes;
    }

    const updated = await this.contactModel
      .findByIdAndUpdate(id, update, { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException('Contact message not found');
    }
    return updated;
  }

  async delete(id: string): Promise<{ message: string }> {
    const deleted = await this.contactModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('Contact message not found');
    }
    return { message: 'Contact message deleted successfully' };
  }

  async getStats(): Promise<{
    total: number;
    unread: number;
    read: number;
    replied: number;
  }> {
    const [total, unread, read, replied] = await Promise.all([
      this.contactModel.countDocuments().exec(),
      this.contactModel.countDocuments({ status: ContactStatus.UNREAD }).exec(),
      this.contactModel.countDocuments({ status: ContactStatus.READ }).exec(),
      this.contactModel.countDocuments({ status: ContactStatus.REPLIED }).exec(),
    ]);

    return { total, unread, read, replied };
  }
}
