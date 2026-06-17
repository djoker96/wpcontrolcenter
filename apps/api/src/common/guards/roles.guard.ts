import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@wpcc/database';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
      throw new ForbiddenException('User roles are not defined');
    }

    // Define role permissions hierarchy: SUPER_ADMIN > ADMIN > OPERATOR > VIEWER
    const roleHierarchy: Record<UserRole, number> = {
      [UserRole.SUPER_ADMIN]: 4,
      [UserRole.ADMIN]: 3,
      [UserRole.OPERATOR]: 2,
      [UserRole.VIEWER]: 1,
    };

    const userWeight = roleHierarchy[user.role as UserRole] || 0;
    
    // Check if user has sufficient access level for any of the required roles
    const isAuthorized = requiredRoles.some(role => userWeight >= roleHierarchy[role]);

    if (!isAuthorized) {
      throw new ForbiddenException('Access denied: insufficient permissions');
    }

    return true;
  }
}
