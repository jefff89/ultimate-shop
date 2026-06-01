import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users.service';
import { Role } from 'src/roles/role.entity';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  roles: Role[];
}

@Injectable()
//  verify the incoming jwt
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          const cookies = request.cookies as Record<string, string> | undefined;
          return cookies?.Authentication ?? null;
        },
      ]),
      secretOrKey: configService.getOrThrow('JWT_SECRET'),
    });
  }
  // here validate method receives the decoded jwt payload ({ userId, iat, exp }).
  // We re-load the user so tokens for deleted accounts stop working, and so the
  // user's roles ride along on request.user for the AdminGuard. Whatever is
  // returned here is attached to request.user by passport.
  async validate(payload: { userId: string }): Promise<AuthenticatedUser> {
    const user = await this.usersService.findOne(payload.userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return { userId: user.id, email: user.email, roles: user.roles ?? [] };
  }
}
