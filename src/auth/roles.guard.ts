import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { Role } from './roles.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true; // no role restriction
    }

    const req = context
      .switchToHttp()
      .getRequest<{ user?: { roles?: Role[] } }>();
    const user = req.user;
    if (!user || !user.roles) return false;

    // If user.roles is string[] or Role[]
    return required.some((role) => user.roles?.includes(role));
  }
}
