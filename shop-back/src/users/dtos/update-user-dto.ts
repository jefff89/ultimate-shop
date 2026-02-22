import { IsEmail, IsString, IsOptional } from 'class-validator';

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email: string | undefined;

  @IsString()
  @IsOptional()
  password: string | undefined;
}
