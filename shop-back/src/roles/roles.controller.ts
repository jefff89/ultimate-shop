import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dtos/create-role-dto';
import { AssignRoleDto } from './dtos/assign-role-dto';
import { JwtAuthGuard } from 'src/users/auth/guards/jwt-auth.guard';
import { AdminGuard } from 'src/guards/admin.gurad';

// Admin-only: creating roles and (especially) assigning them is a direct
// privilege-escalation surface.
@Controller('roles')
@UseGuards(JwtAuthGuard, AdminGuard)
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
