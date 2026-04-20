import { IsString } from 'class-validator';

export class CreateProductTagDto {
  @IsString()
  name!: string;
}
