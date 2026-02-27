/**
 * CurrentUserInterceptor
 *
 * This interceptor is specifically designed to support dependency injection for use
 * within the CurrentUserDecorator. It extracts the userId from the session, retrieves
 * the associated user from the database, and attaches it to the request object.
 *
 * By utilizing this interceptor as a provider, we enable the CurrentUserDecorator to
 * inject the UsersService and access the current user's data within route handlers.
 *
 * Note: This interceptor should be used globally or per module in conjunction with
 * the CurrentUserDecorator for proper dependency injection support.
 */

import {
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Injectable,
} from '@nestjs/common';
import { UsersService } from '../users.service';

@Injectable()
export class CurrentUserInterceptor implements NestInterceptor {
  constructor(private usersService: UsersService) {}

  async intercept(context: ExecutionContext, handler: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const { userId } = request.session || {};
    if (userId) {
      const user = await this.usersService.findOne(userId);
      request.currentUser = user;
    }
    return handler.handle();
  }
}
