import {
  IsNumber,
  IsString,
  Min,
  Max,
  IsLongitude,
  IsLatitude,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class GetEstimateDto {
  @IsString()
  make!: string;

  @IsString()
  model!: string;

  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsNumber()
  @Min(1930)
  @Max(2050)
  year!: number;

  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsNumber()
  @Min(0)
  @Max(1000000)
  mileage!: number;

  @Transform(({ value }: { value: string }) => parseFloat(value))
  @IsLongitude()
  lng!: number;

  @Transform(({ value }: { value: string }) => parseFloat(value))
  @IsLatitude()
  lat!: number;
}
