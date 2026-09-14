/* eslint-disable prettier/prettier */
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { Permission } from './permissions.enum';
import { ManagersService } from '../managers/managers.service';
import { Role } from './roles.enum';

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private managersService: ManagersService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredPermissions || requiredPermissions.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user) {
            throw new ForbiddenException('Authentication required');
        }

        // Admin has all permissions
        if (user.roles?.includes(Role.ADMIN)) {
            return true;
        }

        if (!user.roles?.includes(Role.MANAGER)) {
            throw new ForbiddenException('Insufficient permissions');
        }

        const manager = await this.managersService.findByUserId(user._id);
        if (!manager || manager.status !== 'active') {
            throw new ForbiddenException('Manager account is inactive or not found');
        }

        const hasPermission = requiredPermissions.every((permission) =>
            manager.permissions.includes(permission),
        );

        if (!hasPermission) {
            throw new ForbiddenException('Insufficient permissions');
        }

        return true;
    }
}
