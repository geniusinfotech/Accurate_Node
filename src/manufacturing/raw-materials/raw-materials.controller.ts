import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { RawMaterialsService } from './raw-materials.service';
import { CreateRawMaterialDto } from './dto/create-raw-material.dto';
import { UpdateRawMaterialDto } from './dto/update-raw-material.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Roles } from '../../auth/roles.decorator';
import { Permissions } from '../../auth/permissions.decorator';
import { Role } from '../../auth/roles.enum';
import { Permission } from '../../auth/permissions.enum';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('manufacturing/raw-materials')
export class RawMaterialsController {
  constructor(private readonly rawMaterialsService: RawMaterialsService) {}

  @Post()
  @Permissions(Permission.RAW_MATERIALS_ADD)
  create(@Body() createRawMaterialDto: CreateRawMaterialDto) {
    return this.rawMaterialsService.create(createRawMaterialDto);
  }

  @Get()
  @Permissions(Permission.RAW_MATERIALS_VIEW)
  findAll() {
    return this.rawMaterialsService.findAll();
  }

  @Get(':id')
  @Permissions(Permission.RAW_MATERIALS_VIEW)
  findOne(@Param('id') id: string) {
    return this.rawMaterialsService.findOne(id);
  }

  @Patch(':id')
  @Permissions(Permission.RAW_MATERIALS_EDIT)
  update(
    @Param('id') id: string,
    @Body() updateRawMaterialDto: UpdateRawMaterialDto,
  ) {
    return this.rawMaterialsService.update(id, updateRawMaterialDto);
  }

  @Delete(':id')
  @Permissions(Permission.RAW_MATERIALS_DELETE)
  remove(@Param('id') id: string) {
    return this.rawMaterialsService.remove(id);
  }
}
