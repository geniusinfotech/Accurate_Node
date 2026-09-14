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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions.enum';

@Controller('categories')
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) { }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(Role.ADMIN, Role.MANAGER)
    @Permissions(Permission.CATEGORIES_ADD)
    create(@Body() createCategoryDto: CreateCategoryDto) {
        return this.categoriesService.create(createCategoryDto);
    }

    @Get()
    findAll() {
        return this.categoriesService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.categoriesService.findOne(id);
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
        @Body() updateCategoryDto: any,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        // Convert string boolean back to real boolean if needed
        if (typeof updateCategoryDto.showOnHomepage === 'string') {
            updateCategoryDto.showOnHomepage = updateCategoryDto.showOnHomepage === 'true';
        }
        if (typeof updateCategoryDto.isActive === 'string') {
            updateCategoryDto.isActive = updateCategoryDto.isActive === 'true';
        }

        let newImageFilename: string | undefined;
        if (file) {
            newImageFilename = this.categoriesService.saveImage(file);
        }
        return this.categoriesService.update(id, updateCategoryDto, newImageFilename);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(Role.ADMIN, Role.MANAGER)
    @Permissions(Permission.CATEGORIES_DELETE)
    remove(@Param('id') id: string) {
        return this.categoriesService.remove(id);
    }
}
