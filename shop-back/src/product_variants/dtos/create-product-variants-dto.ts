// create-product-variant.dto.ts
import {
  IsString,
  IsOptional,
  IsDecimal,
  IsBoolean,
  IsUUID,
  IsObject,
  IsArray,
  ArrayUnique,
  Min,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductVariantDto {
  @IsString()
  sku!: string;

  @IsObject()
  @IsOptional()
  options?: Record<string, any>;

  @IsDecimal({ decimal_digits: '0,2' })
  @Type(() => Number)
  price!: number;

  @IsDecimal({ decimal_digits: '0,2' })
  @IsOptional()
  @Type(() => Number)
  compareAtPrice?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  stock?: number = 0;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @IsUUID()
  productId!: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  @IsOptional()
  imageIds?: string[];
}
