import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ShopBrandsService } from '../services/shop-brands.service';
import { CreateShopBrandDto } from '../dto/create-shop-brand.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/roles.enum';

@Controller('shop-brands')
export class ShopBrandsController {
  constructor(private readonly shopBrandsService: ShopBrandsService) {}

  /**
   * Create a new shopBrand (Admin only)
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async create(@Body() dto: CreateShopBrandDto) {
    return this.shopBrandsService.create(dto);
  }

  /**
   * Get all shopBrands
   */
  @Get()
  async findAll() {
    return this.shopBrandsService.findAll();
  }

  /**
   * Get a single shopBrand by ID
   */
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.shopBrandsService.findById(id);
  }

  /**
   * Update a shopBrand (Admin only)
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateShopBrandDto>,
  ) {
    return this.shopBrandsService.update(id, dto);
  }

  /**
   * Toggle shopBrand status (Admin only)
   */
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async toggleStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.shopBrandsService.toggleActive(id, isActive);
  }
}
