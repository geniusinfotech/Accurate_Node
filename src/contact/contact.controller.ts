import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactStatusDto } from './dto/update-contact.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  // Public endpoint for submitting a contact message from the website
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async create(@Body() dto: CreateContactDto) {
    const contact = await this.contactService.create(dto);
    return {
      message: 'Your message has been sent successfully. We will contact you soon.',
      id: contact._id,
    };
  }

  // Admin/Manager: Get contact statistics
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  async getStats() {
    return this.contactService.getStats();
  }

  // Admin/Manager: List contact messages with search and filtering
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  async findAll(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = parseInt(page || '1', 10) || 1;
    const limitNum = parseInt(limit || '50', 10) || 50;
    return this.contactService.findAll(status, search, pageNum, limitNum);
  }

  // Admin/Manager: View single contact message
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  async findById(@Param('id') id: string) {
    return this.contactService.findById(id);
  }

  // Admin/Manager: Update message status (unread/read/replied)
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateContactStatusDto,
  ) {
    return this.contactService.updateStatus(id, dto);
  }

  // Admin/Manager: Delete message
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  async delete(@Param('id') id: string) {
    return this.contactService.delete(id);
  }
}
