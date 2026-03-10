import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  // data is the argument that we povide to decorator
  // context is the request coming to our server
  (_data: never, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    // return request.currentUser; this is for cookieSession Authentication
    return request.user; // this is for passport authentication, validate method of passport automatically pass user object to request object
  },
);
