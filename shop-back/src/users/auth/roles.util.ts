import type { AuthenticatedUser } from './strategies/jwt.strategy';

export const ADMIN_ROLE = 'admin';

// Single source of truth for the admin predicate, shared by AdminGuard and any
// handler that needs an inline owner-or-admin check.
export function hasAdminRole(user: AuthenticatedUser | undefined): boolean {
  return user?.roles?.some((role) => role.name === ADMIN_ROLE) ?? false;
}
