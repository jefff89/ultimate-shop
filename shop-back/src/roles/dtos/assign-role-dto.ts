import { IsNumber } from 'class-validator';

export class AssignRoleDto {
  @IsNumber()
  userId!: number;

  @IsNumber()
  roleId!: number;
}
