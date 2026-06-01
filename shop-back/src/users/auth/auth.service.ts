import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from '../users.service';
import ms from 'ms';
import { ConfigService } from '@nestjs/config';
import { User } from '../user.entity';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { hashPassword, verifyPassword } from './password.util';
import { authCookieOptions } from './cookie';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}
  async signup(email: string, password: string) {
    // See if email in use
    const user = await this.usersService.find(email);
    if (user.length) {
      throw new BadRequestException('email in use');
    }

    // Hash the password (salt generated and prepended inside the helper)
    const result = await hashPassword(password);

    // create a new user and save it
    const newUser = await this.usersService.create(email, result);

    // return the user
    return newUser;
  }

  login(user: User, response: Response) {
    const expires = new Date();
    expires.setMilliseconds(
      expires.getMilliseconds() +
        ms(
          this.configService.getOrThrow<string>(
            'JWT_EXPIRATION',
          ) as ms.StringValue,
        ),
    );
    const tokenPayload = {
      userId: user?.id,
    };
    const token = this.jwtService.sign(tokenPayload);

    response.cookie('Authentication', token, {
      ...authCookieOptions(),
      expires,
    });

    response.json({ tokenPayload });
  }

  // the name is better to be verifyUser rather than signin when we want use the jwt and not the cookieSession
  async signin(email: string, password: string) {
    const [user] = await this.usersService.find(email);
    if (!user) {
      throw new NotFoundException('user not found');
    }
    // constant-time verification against the stored "<salt>.<hash>"
    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      throw new BadRequestException('bad password');
    }
    return user;
  }
}
