import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { randomBytes, scrypt as _scrypt } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(_scrypt);

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService) {}
  async signup(email: string, password: string) {
    // See if email in use
    const user = await this.usersService.find(email);
    if (user.length) {
      throw new BadRequestException('email in use');
    }

    // Hash the user password
    // Generate a salt
    const salt = randomBytes(8).toString('hex');

    // Hash the salt and the password together
    const hash = (await scrypt(password, salt, 32)) as Buffer;

    // Join the hashed result and the salt together
    const result = salt + '.' + hash.toString('hex');

    // create a new user and save it
    const newUser = await this.usersService.create(email, result);

    // return the user
    return newUser;
  }

  async signin(email: string, password: string) {
    const [user] = await this.usersService.find(email);
    if (!user) {
      throw new NotFoundException('user not found');
    }
    // separating salt and hash of the user retrieved from database
    const [salt, storedHash] = user.password.split('.');

    // using salt to hash the password povided by user
    const hash = (await scrypt(password, salt, 32)) as Buffer;

    // comparing hash with the storedHash
    if (storedHash !== hash.toString('hex')) {
      throw new BadRequestException('bad password');
    }
    return user;
  }
}
