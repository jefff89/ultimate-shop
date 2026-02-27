import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core'; // for globally scoped ineterceptors
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { AuthService } from './auth.service';
import { User } from './user.entity';
import { CurrentUserInterceptor } from './interceptors/current-user-interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([User])], // Connect the entity to its parent module. And creates the repository
  controllers: [UsersController],
  providers: [
    UsersService,
    AuthService,
    { provide: APP_INTERCEPTOR, useClass: CurrentUserInterceptor },
  ],
})
export class UsersModule {}
