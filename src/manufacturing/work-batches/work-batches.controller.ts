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
import { WorkBatchesService } from './work-batches.service';
import { CreateWorkBatchDto } from './dto/create-work-batch.dto';
import { UpdateWorkBatchDto } from './dto/update-work-batch.dto';
import { AddWorkBatchCompletionDto } from './dto/add-work-batch-completion.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Roles } from '../../auth/roles.decorator';
import { Permissions } from '../../auth/permissions.decorator';
import { Role } from '../../auth/roles.enum';
import { Permission } from '../../auth/permissions.enum';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('manufacturing/work-batches')
export class WorkBatchesController {
  constructor(private readonly workBatchesService: WorkBatchesService) {}

  @Post()
  @Permissions(Permission.WORKERS_ASSIGN)
  create(@Body() createWorkBatchDto: CreateWorkBatchDto) {
    return this.workBatchesService.create(createWorkBatchDto);
  }

  @Get()
  @Permissions(Permission.WORKERS_VIEW)
  findAll() {
    return this.workBatchesService.findAll();
  }

  @Get(':id')
  @Permissions(Permission.WORKERS_VIEW)
  findOne(@Param('id') id: string) {
    return this.workBatchesService.findOne(id);
  }

  @Patch(':id/complete')
  @Permissions(Permission.WORKERS_MARK_DONE)
  addCompletion(
    @Param('id') id: string,
    @Body() completionDto: AddWorkBatchCompletionDto,
  ) {
    return this.workBatchesService.addCompletion(id, completionDto);
  }

  @Patch(':id')
  @Permissions(Permission.WORKERS_ASSIGN)
  update(
    @Param('id') id: string,
    @Body() updateWorkBatchDto: UpdateWorkBatchDto,
  ) {
    return this.workBatchesService.update(id, updateWorkBatchDto);
  }

  @Delete(':id')
  @Permissions(Permission.WORKERS_ASSIGN)
  remove(@Param('id') id: string) {
    return this.workBatchesService.remove(id);
  }
}
