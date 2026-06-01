import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

// Passport attaches the authenticated principal to request.user. The JWT
// strategy returns an AuthenticatedUser; the local strategy returns a User
// entity during signin. Callers annotate the param with the type they expect.
export const CurrentUser = createParamDecorator(
  (_data: never, context: ExecutionContext): AuthenticatedUser | undefined => {
    const request = context.switchToHttp().getRequest<Request>();
    return request.user as AuthenticatedUser | undefined;
  },
);
