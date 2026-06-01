import { Expose, Transform } from 'class-transformer';
import type { Report } from '../report.entity';

export class ReportDto {
  @Expose()
  id!: number;

  @Expose()
  price!: number;

  @Expose()
  year!: number;

  @Expose()
  lng!: number;

  @Expose()
  lat!: number;

  @Expose()
  make!: string;

  @Expose()
  model!: string;

  @Expose()
  mileage!: number;

  @Expose()
  approved!: boolean;

  @Transform(({ obj }: { obj: Report }) => obj.user.id) // obj is the original report entity with user information in it, we only need user id, so we extract it and put it into the userId column
  @Expose()
  userId!: string;
}
