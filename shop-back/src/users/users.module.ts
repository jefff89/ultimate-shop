import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { AuthService } from './auth/auth.service';
import { User } from './user.entity';
import { LocalStrategy } from './auth/strategies/local.strategy';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './auth/strategies/jwt.strategy';
@Module({
  imports: [
    TypeOrmModule.forFeature([User]), // Connect the entity to its parent module. And creates the repository
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.getOrThrow('JWT_EXPIRATION'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, AuthService, LocalStrategy, JwtStrategy],
})
export class UsersModule {}
