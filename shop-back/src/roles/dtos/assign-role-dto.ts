import { IsNumber, IsUUID } from 'class-validator';

export class AssignRoleDto {
  @IsUUID()
  userId!: string;

  @IsNumber()
  roleId!: number;
}
