import { CanActivate, ExecutionContext } from '@nestjs/common';

export class AdminGuard implements CanActivate {
  canActivate(
    context: ExecutionContext, // is like a wrapper around incoming request
  ) {
    const request = context.switchToHttp().getRequest();
    if (!request.currentUser) {
      return false;
    }
    return request.currentUser.admin;
    // if (request.currentUser.admin) {
    //   return true;
    // } else {
    //   return false;
    // }
  }
}
