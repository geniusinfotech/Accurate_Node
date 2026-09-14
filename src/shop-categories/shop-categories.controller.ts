/* eslint-disable prettier/prettier */
import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
    UseGuards
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ShopCategoriesService } from './shop-categories.service';
import { CreateShopCategoryDto } from './dto/create-shop-category.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions.enum';

@Controller('shop-categories')
export class ShopCategoriesController {
    constructor(private readonly shopCategoriesService: ShopCategoriesService) { }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(Role.ADMIN, Role.MANAGER)
    @Permissions(Permission.CATEGORIES_ADD)
    create(@Body() createShopCategoryDto: CreateShopCategoryDto) {
        return this.shopCategoriesService.create(createShopCategoryDto);
    }

    @Get()
    findAll() {
        return this.shopCategoriesService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.shopCategoriesService.findOne(id);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(Role.ADMIN, Role.MANAGER)
    @Permissions(Permission.CATEGORIES_EDIT)
    @UseInterceptors(
        FileInterceptor('image', {
            storage: memoryStorage(),
            fileFilter: (req, file, cb) => {
                if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
                    return cb(new BadRequestException('Only image files are allowed!'), false);
                }
                cb(null, true);
            },
            limits: { fileSize: 10 * 1024 * 1024 },
        }),
    )
    update(
        @Param('id') id: string,
        @Body() updateShopCategoryDto: any,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        // Convert string boolean back to real boolean if needed
        if (typeof updateShopCategoryDto.showOnHomepage === 'string') {
            updateShopCategoryDto.showOnHomepage = updateShopCategoryDto.showOnHomepage === 'true';
        }
        if (typeof updateShopCategoryDto.isActive === 'string') {
            updateShopCategoryDto.isActive = updateShopCategoryDto.isActive === 'true';
        }

        let newImageFilename: string | undefined;
        if (file) {
            newImageFilename = this.shopCategoriesService.saveImage(file);
        }
        return this.shopCategoriesService.update(id, updateShopCategoryDto, newImageFilename);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(Role.ADMIN, Role.MANAGER)
    @Permissions(Permission.CATEGORIES_DELETE)
    remove(@Param('id') id: string) {
        return this.shopCategoriesService.remove(id);
    }
}
