import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { BrandsService } from '../services/brands.service';
import { CreateBrandDto } from '../dto/create-brand.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/roles.enum';

@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  /**
   * Create a new brand (Admin only)
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async create(@Body() dto: CreateBrandDto) {
    return this.brandsService.create(dto);
  }

  /**
   * Get all brands
   */
  @Get()
  async findAll() {
    return this.brandsService.findAll();
  }

  /**
   * Get a single brand by ID
   */
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.brandsService.findById(id);
  }

  /**
   * Update a brand (Admin only)
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async update(@Param('id') id: string, @Body() dto: Partial<CreateBrandDto>) {
    return this.brandsService.update(id, dto);
  }

  /**
   * Toggle brand status (Admin only)
   */
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async toggleStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.brandsService.toggleActive(id, isActive);
  }
}
