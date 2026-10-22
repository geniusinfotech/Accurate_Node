/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  UseGuards
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { BannersService } from './banners.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions.enum';

@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) { }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.BANNERS_ADD)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'desktopMedia', maxCount: 1 },
        { name: 'mobileMedia', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        fileFilter: (req, file, cb) => {
          if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm|ogg|mov)$/i)) {
            return cb(
              new BadRequestException('Only safe image and video files are allowed!'),
              false,
            );
          }
          cb(null, true);
        },
        limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
      },
    ),
  )
  create(
    @Body() dto: CreateBannerDto,
    @UploadedFiles() files: { desktopMedia?: Express.Multer.File[]; mobileMedia?: Express.Multer.File[] },
  ) {
    if (!files || !files.desktopMedia) {
      throw new BadRequestException('Desktop media file is required');
    }
    return this.bannersService.create(dto, files);
  }

  @Get()
  findAll() {
    return this.bannersService.findAll();
  }

  @Get('active')
  findActive() {
    return this.bannersService.findActive();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bannersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.BANNERS_EDIT)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'desktopMedia', maxCount: 1 },
        { name: 'mobileMedia', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        fileFilter: (req, file, cb) => {
          if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm|ogg|mov)$/i)) {
            return cb(
              new BadRequestException('Only safe image and video files are allowed!'),
              false,
            );
          }
          cb(null, true);
        },
        limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
      },
    ),
  )
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateBannerDto>,
    @UploadedFiles() files: { desktopMedia?: Express.Multer.File[]; mobileMedia?: Express.Multer.File[] },
  ) {
    return this.bannersService.update(id, dto, files || {});
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.BANNERS_DELETE)
  remove(@Param('id') id: string) {
    return this.bannersService.remove(id);
  }
}
