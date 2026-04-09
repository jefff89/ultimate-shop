import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesService } from './roles.service';
import { Role } from './role.entity';
import { User } from 'src/users/user.entity';
@Module({
  imports: [TypeOrmModule.forFeature([Role, User])],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
