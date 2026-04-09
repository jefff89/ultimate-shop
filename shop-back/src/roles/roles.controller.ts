import { Body, Controller, Post } from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dtos/create-role-dto';
import { AssignRoleDto } from './dtos/assign-role-dto';

@Controller('roles')
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Post()
  async createRole(@Body() body: CreateRoleDto) {
    await this.rolesService.create(body.name);
  }
  @Post('/assign')
  async assignRoleToUser(@Body() body: AssignRoleDto) {
    await this.rolesService.assign(body.userId, body.roleId);
  }
}
