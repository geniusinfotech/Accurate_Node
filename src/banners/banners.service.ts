/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Banner, BannerDocument } from './schemas/banner.schema';
import { CreateBannerDto } from './dto/create-banner.dto';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, extname } from 'path';
import { RedisCacheService } from '../common/cache/cache.service';

@Injectable()
export class BannersService {
  private readonly uploadDir = join(
    process.cwd(),
    'uploads',
    'banners',
  );

  constructor(
    @InjectModel(Banner.name)
    private readonly bannerModel: Model<BannerDocument>,
    private readonly cache: RedisCacheService,
  ) {
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  saveFile(file: Express.Multer.File): string {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname);
    const filename = `banner-${uniqueSuffix}${ext}`;
    const destPath = join(this.uploadDir, filename);

    const fs = require('fs');
    fs.writeFileSync(destPath, file.buffer);
    return filename;
  }

  removeFile(filename: string): void {
    try {
      const filePath = join(this.uploadDir, filename);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch {}
  }

  getMediaType(filename: string): 'image' | 'video' {
      const ext = extname(filename).toLowerCase();
      if (['.mp4', '.webm', '.ogg', '.mov'].includes(ext)) {
          return 'video';
      }
      return 'image';
  }

  async create(
    dto: CreateBannerDto,
    files: { desktopMedia?: Express.Multer.File[]; mobileMedia?: Express.Multer.File[] },
  ): Promise<Banner> {
    const bannerData: any = { ...dto };

    if (files.desktopMedia?.[0]) {
        bannerData.desktopMedia = this.saveFile(files.desktopMedia[0]);
        bannerData.desktopMediaType = this.getMediaType(bannerData.desktopMedia);
    }
    
    if (files.mobileMedia?.[0]) {
        bannerData.mobileMedia = this.saveFile(files.mobileMedia[0]);
        bannerData.mobileMediaType = this.getMediaType(bannerData.mobileMedia);
    }

    const banner = new this.bannerModel(bannerData);
    await banner.save();
    await this.cache.delByPrefix('banners:');
    return banner;
  }

  async findAll(): Promise<Banner[]> {
    const cacheKey = 'banners:v1:all';
    const cached = await this.cache.get<Banner[]>(cacheKey);
    if (cached) return cached;

    const banners = await this.bannerModel.find().sort({ displayOrder: 1, createdAt: -1 });
    await this.cache.set(cacheKey, banners);
    return banners;
  }

  async findActive(): Promise<Banner[]> {
    const cacheKey = 'banners:v1:active';
    const cached = await this.cache.get<Banner[]>(cacheKey);
    if (cached) return cached;

    const banners = await this.bannerModel
      .find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: -1 });
    await this.cache.set(cacheKey, banners);
    return banners;
  }

  async findOne(id: string): Promise<Banner> {
    const banner = await this.bannerModel.findById(id);
    if (!banner) {
      throw new NotFoundException(`Banner with ID ${id} not found`);
    }
    return banner;
  }

  async update(
    id: string,
    dto: Partial<CreateBannerDto>,
    files: { desktopMedia?: Express.Multer.File[]; mobileMedia?: Express.Multer.File[] },
  ): Promise<Banner> {
    const existing = await this.bannerModel.findById(id);
    if (!existing) {
      throw new NotFoundException(`Banner with ID ${id} not found`);
    }

    const updateData: any = { ...dto };

    if (files.desktopMedia?.[0]) {
      this.removeFile(existing.desktopMedia);
      updateData.desktopMedia = this.saveFile(files.desktopMedia[0]);
      updateData.desktopMediaType = this.getMediaType(updateData.desktopMedia);
    }

    if (files.mobileMedia?.[0]) {
      if (existing.mobileMedia) this.removeFile(existing.mobileMedia);
      updateData.mobileMedia = this.saveFile(files.mobileMedia[0]);
      updateData.mobileMediaType = this.getMediaType(updateData.mobileMedia);
    }

    const updated = await this.bannerModel.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    if (!updated) {
      throw new NotFoundException(`Banner with ID ${id} not found`);
    }
    await this.cache.delByPrefix('banners:');
    return updated;
  }

  async remove(id: string): Promise<Banner> {
    const banner = await this.bannerModel.findById(id);
    if (!banner) {
      throw new NotFoundException(`Banner with ID ${id} not found`);
    }

    this.removeFile(banner.desktopMedia);
    if (banner.mobileMedia) {
      this.removeFile(banner.mobileMedia);
    }

    const deleted = await this.bannerModel.findByIdAndDelete(id);
    if (!deleted) {
      throw new NotFoundException(`Banner with ID ${id} not found`);
    }
    await this.cache.delByPrefix('banners:');
    return deleted;
  }
}
