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
import { WorkersService } from './workers.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/roles.enum';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions.enum';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('manufacturing/workers')
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Post()
  @Permissions(Permission.WORKERS_ADD)
  create(@Body() createWorkerDto: CreateWorkerDto) {
    return this.workersService.create(createWorkerDto);
  }

  @Get()
  @Permissions(Permission.WORKERS_VIEW)
  findAll() {
    return this.workersService.findAll();
  }

  @Get(':id')
  @Permissions(Permission.WORKERS_VIEW)
  findOne(@Param('id') id: string) {
    return this.workersService.findOne(id);
  }

  @Patch(':id')
  @Permissions(Permission.WORKERS_EDIT)
  update(@Param('id') id: string, @Body() updateWorkerDto: UpdateWorkerDto) {
    return this.workersService.update(id, updateWorkerDto);
  }

  @Delete(':id')
  @Permissions(Permission.WORKERS_DELETE)
  remove(@Param('id') id: string) {
    return this.workersService.remove(id);
  }
}
