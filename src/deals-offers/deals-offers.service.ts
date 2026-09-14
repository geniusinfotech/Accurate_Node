import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DealOffer, DealOfferDocument } from './schemas/deal-offer.schema';
import { CreateDealOfferDto } from './dto/create-deal-offer.dto';
import { RedisCacheService } from '../common/cache/cache.service';

@Injectable()
export class DealsOffersService {
  constructor(
    @InjectModel(DealOffer.name)
    private dealOfferModel: Model<DealOfferDocument>,
    private cache: RedisCacheService,
  ) {}

  // Create a deal/offer
  async create(dto: CreateDealOfferDto): Promise<DealOffer> {
    const created = new this.dealOfferModel(dto);
    await created.save();
    await this.cache.delByPrefix('deals:');
    return created;
  }

  // Find all deals/offers
  async findAll(activeOnly: boolean = false): Promise<DealOffer[]> {
    const cacheKey = activeOnly ? 'deals:v1:activeAll' : 'deals:v1:all';
    const cached = await this.cache.get<DealOffer[]>(cacheKey);
    if (cached) return cached;

    const query = activeOnly ? { isActive: true } : {};
    const data = await this.dealOfferModel.find(query).sort({ createdAt: -1 });
    await this.cache.set(cacheKey, data);
    return data;
  }

  // Find active deals/offers (for frontend)
  async findActive(): Promise<DealOffer[]> {
    const cacheKey = 'deals:v1:active';
    const cached = await this.cache.get<DealOffer[]>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const data = await this.dealOfferModel
      .find({
        isActive: true,
        // validFrom: { $lte: now },
        // validUntil: { $gte: now },
      })
      .sort({ createdAt: -1 });
    await this.cache.set(cacheKey, data);
    return data;
  }

  // Find a deal/offer by id
  async findById(id: string): Promise<DealOffer> {
    const deal = await this.dealOfferModel.findById(id);
    if (!deal) throw new NotFoundException('Deal/Offer not found');
    return deal;
  }

  // Update deal/offer
  async update(id: string, dto: CreateDealOfferDto): Promise<DealOffer> {
    const deal = await this.dealOfferModel.findByIdAndUpdate(id, dto, {
      new: true,
    });
    if (!deal) throw new NotFoundException('Deal/Offer not found');
    await this.cache.delByPrefix('deals:');
    return deal;
  }

  // Toggle active status
  async toggleActive(id: string): Promise<DealOffer> {
    const deal = await this.findById(id);
    deal.isActive = !deal.isActive;
    const updated = await this.dealOfferModel.findByIdAndUpdate(
      id,
      { isActive: deal.isActive },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Deal/Offer not found');
    await this.cache.delByPrefix('deals:');
    return updated;
  }

  // Delete deal/offer
  async remove(id: string) {
    const result = await this.dealOfferModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Deal/Offer not found');
    await this.cache.delByPrefix('deals:');
    return result;
  }
}
