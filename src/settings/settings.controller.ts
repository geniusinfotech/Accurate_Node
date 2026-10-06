import {
  Controller,
  Get,
  Param,
  Body,
  Post,
  Put,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Role } from '../auth/roles.enum';
import { Permission } from '../auth/permissions.enum';
import { APISuccess } from '../common/api-response';

const PUBLIC_SETTINGS = ['shipping'];

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // Public read: only keys the storefront needs. Anything else stays private.
  @Get(':key')
  async getSetting(@Param('key') key: string) {
    if (!PUBLIC_SETTINGS.includes(key)) throw new NotFoundException();
    const value = await this.settingsService.getSetting(key);
    return APISuccess.ok({ key, value });
  }

  @Post(':key')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Permissions(Permission.SHIPPING_EDIT)
  async setSetting(@Param('key') key: string, @Body() body: any) {
    const result = await this.settingsService.setSetting(key, body.value);
    return APISuccess.ok(result);
  }
}
