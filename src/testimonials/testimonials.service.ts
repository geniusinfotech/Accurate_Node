/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Testimonial, TestimonialDocument } from './schemas/testimonial.schema';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { RedisCacheService } from '../common/cache/cache.service';

@Injectable()
export class TestimonialsService {
  constructor(
    @InjectModel(Testimonial.name) private testimonialModel: Model<TestimonialDocument>,
    private cache: RedisCacheService,
  ) { }

  // Create a testimonial
  async create(dto: CreateTestimonialDto): Promise<Testimonial> {
    const created = new this.testimonialModel(dto);
    await created.save();
    await this.cache.delByPrefix('testimonials:');
    return created;
  }

  // Find all testimonials (sorted by sortOrder)
  async findAll(): Promise<Testimonial[]> {
    const cacheKey = 'testimonials:v1:all';
    const cached = await this.cache.get<Testimonial[]>(cacheKey);
    if (cached) return cached;

    const data = await this.testimonialModel.find().sort({ sortOrder: 1, createdAt: -1 });
    await this.cache.set(cacheKey, data);
    return data;
  }

  // Find active testimonials only (for frontend, sorted by sortOrder)
  async findActive(): Promise<Testimonial[]> {
    const cacheKey = 'testimonials:v1:active';
    const cached = await this.cache.get<Testimonial[]>(cacheKey);
    if (cached) return cached;

    const data = await this.testimonialModel.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 });
    await this.cache.set(cacheKey, data);
    return data;
  }

  // Find a testimonial by id
  async findById(id: string): Promise<Testimonial> {
    const testimonial = await this.testimonialModel.findById(id);
    if (!testimonial) throw new NotFoundException('Testimonial not found');
    return testimonial;
  }

  // Update testimonial
  async update(id: string, dto: CreateTestimonialDto): Promise<Testimonial> {
    const testimonial = await this.testimonialModel
      .findByIdAndUpdate(id, dto, { new: true });
    if (!testimonial) throw new NotFoundException('Testimonial not found');
    await this.cache.delByPrefix('testimonials:');
    return testimonial;
  }

  // Delete testimonial
  async remove(id: string) {
    const result = await this.testimonialModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Testimonial not found');
    await this.cache.delByPrefix('testimonials:');
    return result;
  }

  // Toggle active status
  async toggleActive(id: string): Promise<Testimonial> {
    const testimonial = await this.findById(id);
    testimonial.isActive = !testimonial.isActive;
    const updated = await this.testimonialModel
      .findByIdAndUpdate(id, { isActive: testimonial.isActive }, { new: true });
    if (!updated) throw new NotFoundException('Testimonial not found');
    await this.cache.delByPrefix('testimonials:');
    return updated;
  }
}
