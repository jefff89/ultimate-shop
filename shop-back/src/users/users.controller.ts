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
  Session,
  UseGuards,
  Res,
  Req,
} from '@nestjs/common';
import { CreateUserDto } from './dtos/create-user-dto';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dtos/update-user-dto';
import { Serialize } from 'src/interceptors/serialize.interceptor';
import { UserDto } from './dtos/user.dto';
import { AuthService } from './auth/auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import type { Response } from 'express';
// import { AuthGuard } from 'src/guards/auth.gurad';
import { User } from './user.entity';
import { LocalAuthGuard } from './auth/guards/local-auth.guard';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Controller('auth')
// @Serialize(UserDto) // interceptor for sending requested response out without password included applied to all controller routes
export class UsersController {
  constructor(
    private usersService: UsersService,
    private authService: AuthService,
  ) {}

  // @Get('/whoami')
  // whoAmI(@Session() session: any) {
  //   return this.usersService.findOne(session.userId);
  // }
  // @Get('/whoami')
  // @UseGuards(AuthGuard) // this is for cookieSession method of authetiction
  //   whoAmI(@CurrentUser() user: User) {
  //   return user;
  // }
  @Get('/whoami')
  @UseGuards(JwtAuthGuard) // this is for jwt method of authentication
  whoAmI(@CurrentUser() userId) {
    return userId.userId;
  }

  @Post('/signout')
  @UseGuards(JwtAuthGuard)
  signout(@Req() req: Request, @Res() res: Response) {
    // 1️⃣ Tell the browser to delete the cookie
    res.clearCookie('Authentication', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      // If you set a Path when creating the cookie, include it here as well:
      // path: '/',
    });

    // 2️⃣ Optionally, if you keep a server‑side blacklist, add the token to it:
    // const token = req.cookies.token;   // or req.headers.authorization
    // await this.tokenBlacklistService.add(token);

    // 3️⃣ Send a short success response (or redirect)
    return res.status(200).json({ message: 'Signed out' });
  }

  @Post('/signup')
  async createUser(@Body() body: CreateUserDto, @Session() session: any) {
    const user = await this.authService.signup(body.email, body.password);
    session.userId = user.id;
    return user;
  }

  // @Post('/signin')
  // async signin(@Body() body: CreateUserDto, @Session() session: any) {
  //   const user = await this.authService.signin(body.email, body.password);
  //   session.userId = user.id;
  //   return user;
  // }

  // sign in with passport method
  @UseGuards(LocalAuthGuard)
  @Post('/signin')
  async signin(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.login(user, response);
  }

  // @UseInterceptors( new SerializeInterceptor(UserDto)) // for sending out responeses without including password
  // @Serialize(UserDto) // instead of using long line above, we wrap the interceptor in a decorator
  @Get('/:id')
  async findUserById(@Param('id') id: string) {
    // console.log('handler is running'); // to see in SerializeInterceptor it runs after context and before handler logs there
    const user = await this.usersService.findOne(parseInt(id));
    if (!user) {
      throw new NotFoundException('user not found');
    }
    return user;
  }

  @Get()
  findUsersWithEmail(@Query('email') email: string) {
    return this.usersService.find(email);
  }
  @Delete('/:id')
  removeUserById(@Param('id') id: string) {
    return this.usersService.remove(parseInt(id));
  }
  @Patch('/:id')
  updateUserById(@Param('id') id: string, @Body() body: UpdateUserDto) {
    return this.usersService.update(parseInt(id), body);
  }
}
