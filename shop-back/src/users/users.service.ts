import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  create(email: string, password: string) {
    throw new Error('Method not implemented.');
  }
}
