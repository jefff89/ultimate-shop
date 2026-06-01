import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  NotFoundException,
  UseGuards,
  Res,
} from '@nestjs/common';
import { CreateUserDto } from './dtos/create-user-dto';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dtos/update-user-dto';
import { Serialize } from 'src/interceptors/serialize.interceptor';
import { UserDto } from './dtos/user.dto';
import { AuthService } from './auth/auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AdminGuard } from 'src/guards/admin.gurad';
import { User } from './user.entity';
import { LocalAuthGuard } from './auth/guards/local-auth.guard';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from './auth/strategies/jwt.strategy';
import { hasAdminRole } from './auth/roles.util';
import { authCookieOptions } from './auth/cookie';

@Controller('auth')
@Serialize(UserDto) // interceptor for sending requested response out without password included applied to all controller routes
export class UsersController {
  constructor(
    private usersService: UsersService,
    private authService: AuthService,
  ) {}

  @Get('/whoami')
  @UseGuards(JwtAuthGuard) // this is for jwt method of authentication
  whoAmI(@CurrentUser() user: AuthenticatedUser) {
    // Return clean JSON so the frontend can res.json() directly.
    // @Serialize(UserDto) exposes `id` and strips the absent `email`.
    return { id: user.userId };
  }

  @Post('/signout')
  @UseGuards(JwtAuthGuard)
  signout(@Res() res: Response) {
    // Clear the cookie using the same attributes it was set with (see cookie.ts),
    // otherwise the browser won't delete it.
    res.clearCookie('Authentication', authCookieOptions());

    return res.status(200).json({ message: 'Signed out' });
  }

  // Tight limit on account creation to slow abuse.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('/signup')
  async createUser(@Body() body: CreateUserDto) {
    return this.authService.signup(body.email, body.password);
  }

  // sign in with passport method. Tight limit to blunt brute-force / stuffing.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UseGuards(LocalAuthGuard)
  @Post('/signin')
  signin(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.login(user, response);
  }

  // Admin-only: looking users up by email is an account-enumeration primitive.
  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  findUsersWithEmail(@Query('email') email: string) {
    return this.usersService.find(email);
  }

  @Get('/:id')
  @UseGuards(JwtAuthGuard)
  async findUserById(
    @Param('id') id: string,
    @CurrentUser() current: AuthenticatedUser,
  ) {
    // Owner or admin may read an account.
    this.assertCanAccess(id, current, { allowAdmin: true });
    const user = await this.usersService.findOne(id);
    if (!user) {
      throw new NotFoundException('user not found');
    }
    return user;
  }

  @Delete('/:id')
  @UseGuards(JwtAuthGuard)
  removeUserById(
    @Param('id') id: string,
    @CurrentUser() current: AuthenticatedUser,
  ) {
    this.assertCanAccess(id, current);
    return this.usersService.remove(id);
  }

  @Patch('/:id')
  @UseGuards(JwtAuthGuard)
  updateUserById(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @CurrentUser() current: AuthenticatedUser,
  ) {
    this.assertCanAccess(id, current);
    return this.usersService.update(id, body);
  }

  // Enforces that the caller owns the target account (or, when allowed, is an
  // admin). Throws 404 rather than 403 on a mismatch so we don't reveal whether
  // the id exists.
  private assertCanAccess(
    id: string,
    current: AuthenticatedUser,
    { allowAdmin = false }: { allowAdmin?: boolean } = {},
  ): void {
    if (id === current.userId) {
      return;
    }
    if (allowAdmin && hasAdminRole(current)) {
      return;
    }
    throw new NotFoundException('user not found');
  }
}
