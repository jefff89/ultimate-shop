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
} from '@nestjs/common';
import { CreateUserDto } from './dtos/create-user-dto';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dtos/update-user-dto';
import { Serialize } from 'src/interceptors/serialize.interceptor';
import { UserDto } from './dtos/user.dto';
@Controller('auth')
@Serialize(UserDto) // interceptor for sending requested response out without password included applied to all controller routes
export class UsersController {
  constructor(private usersService: UsersService) {}
  @Post('/signup')
  createUser(@Body() body: CreateUserDto) {
    this.usersService.create(body.email, body.password);
  }

  // @UseInterceptors( new SerializeInterceptor(UserDto)) // for sending out responeses without including password
  // @Serialize(UserDto) // instead of using long line above, we wrap the interceptor in a decorator
  @Get('/:id')
  async findUserById(@Param('id') id: string) {
    console.log('handler is running'); // to see in SerializeInterceptor it runs after context and before handler logs there
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
