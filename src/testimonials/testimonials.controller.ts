/* eslint-disable prettier/prettier */
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TestimonialsService } from './testimonials.service';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { CreateTestimonialWithFileDto } from './dto/create-testimonial-with-file.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Role } from '../auth/roles.enum';
import { Permission } from '../auth/permissions.enum';

@Controller('testimonials')
export class TestimonialsController {
  constructor(private testimonialsService: TestimonialsService) { }

  // Public endpoint - Get all active testimonials (for frontend)
  @Get('active')
  async findActive() {
    return this.testimonialsService.findActive();
  }

  // Public endpoint - Get all testimonials
  @Get()
  async findAll() {
    return this.testimonialsService.findAll();
  }

  // Public endpoint - Get single testimonial
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.testimonialsService.findById(id);
  }

  // Admin only - Create testimonial with image upload
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.TESTIMONIALS_ADD)
  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Body() dto: CreateTestimonialWithFileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // Handle image upload
    if (file) {
      if (file.filename) {
        dto.image = file.filename;
      } else if (file.buffer) {
        // File is in memory, save it to disk
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = file.originalname.split('.').pop() || 'jpg, png, jpeg';
        const filename = `testimonial-${uniqueSuffix}.${ext}`;

        const fs = require('fs');
        const path = require('path');
        const uploadPath = path.join(__dirname, '..', '..', 'uploads');

        // Ensure uploads directory exists
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }

        const filePath = path.join(uploadPath, filename);
        fs.writeFileSync(filePath, file.buffer);

        dto.image = filename;
      } else {
        throw new BadRequestException('Invalid file upload.');
      }
    }

    // Validate that at least image or videoLink is provided
    if (!dto.image && !dto.youtubeUrl) {
      throw new BadRequestException('Either image or video link must be provided.');
    }

    return this.testimonialsService.create(dto as CreateTestimonialDto);
  }

  // Admin only - Update testimonial
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.TESTIMONIALS_EDIT)
  @Patch(':id')
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Param('id') id: string,
    @Body() dto: CreateTestimonialWithFileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {

    // Handle image upload
    if (file) {
      if (file.filename) {
        dto.image = file.filename;
      } else if (file.buffer) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = file.originalname.split('.').pop() || 'jpg, png, jpeg';
        const filename = `testimonial-${uniqueSuffix}.${ext}`;

        const fs = require('fs');
        const path = require('path');
        const uploadPath = path.join(__dirname, '..', '..', 'uploads');

        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }

        const filePath = path.join(uploadPath, filename);
        fs.writeFileSync(filePath, file.buffer);

        dto.image = filename;
      } else {
        throw new BadRequestException('Invalid file upload.');
      }
    }

    return this.testimonialsService.update(id, dto as CreateTestimonialDto);
  }

  // Admin only - Toggle active status
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.TESTIMONIALS_TOGGLE)
  @Patch(':id/toggle-active')
  async toggleActive(@Param('id') id: string) {
    return this.testimonialsService.toggleActive(id);
  }

  // Admin only - Delete testimonial
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.TESTIMONIALS_DELETE)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.testimonialsService.remove(id);
  }
}
