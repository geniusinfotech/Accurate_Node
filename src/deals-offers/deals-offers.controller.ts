import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DealsOffersService } from './deals-offers.service';
import { CreateDealOfferDto } from './dto/create-deal-offer.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Role } from '../auth/roles.enum';
import { Permission } from '../auth/permissions.enum';
import { ImageUtils } from '../common/utils/image.utils';

@Controller('deals-offers')
export class DealsOffersController {
  constructor(
    private dealsOffersService: DealsOffersService,
    private imageUtils: ImageUtils,
  ) {}

  // Get all deals/offers (admin)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.OFFERS_VIEW)
  @Get()
  async findAll(@Query('activeOnly') activeOnly?: string) {
    return this.dealsOffersService.findAll(activeOnly === 'true');
  }

  // Get active deals/offers (public)
  @Get('active')
  async findActive() {
    return this.dealsOffersService.findActive();
  }

  // Get single deal/offer
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.dealsOffersService.findById(id);
  }

  // Create deal/offer
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.OFFERS_ADD)
  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Body() dto: CreateDealOfferDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // Handle image upload
    if (file) {
      try {
        const filename = await this.imageUtils.compressImage(file);
        // Store the public URL path (files are served from /uploads/).
        dto.image = `/uploads/${filename}`;
      } catch (error) {
        console.error('Error processing image:', error);
        throw new BadRequestException(
          'Error processing image: ' + error.message,
        );
      }
    }
    return this.dealsOffersService.create(dto);
  }

  // Update deal/offer
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.OFFERS_EDIT)
  @Patch(':id')
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Param('id') id: string,
    @Body() dto: CreateDealOfferDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // Handle image upload
    if (file) {
      try {
        const filename = await this.imageUtils.compressImage(file);
        // Store the public URL path (files are served from /uploads/).
        dto.image = `/uploads/${filename}`;
      } catch (error) {
        console.error('Error processing image:', error);
        throw new BadRequestException(
          'Error processing image: ' + error.message,
        );
      }
    } else if (dto.image && dto.image.trim() !== '') {
      // Keep existing image URL from frontend
      console.log('Preserving existing image:', dto.image);
    } else {
      // Fetch existing deal to preserve image
      const existingDeal = await this.dealsOffersService.findById(id);
      if (existingDeal && existingDeal.image) {
        dto.image = existingDeal.image;
      }
    }
    return this.dealsOffersService.update(id, dto);
  }

  // Toggle active status
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.OFFERS_TOGGLE)
  @Patch(':id/toggle-active')
  async toggleActive(@Param('id') id: string) {
    return this.dealsOffersService.toggleActive(id);
  }

  // Delete deal/offer
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.OFFERS_DELETE)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.dealsOffersService.remove(id);
  }
}
