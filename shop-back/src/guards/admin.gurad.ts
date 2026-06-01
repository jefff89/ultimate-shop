import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from 'src/users/auth/strategies/jwt.strategy';
import { hasAdminRole } from 'src/users/auth/roles.util';

// Role-based admin check. Must run *after* JwtAuthGuard so request.user is
// populated by passport. The principal carries its eager-loaded roles, so we
// grant access only when the user holds the admin role.
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();
    return hasAdminRole(request.user);
  }
}
