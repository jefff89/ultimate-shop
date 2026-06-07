import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Query-param DTO for GET /products (Phase 6).
 *
 * Defense-in-depth only: the service re-clamps `limit` with the exact
 * mock-identical clamp (the source of truth for CAT-03). The @Transform
 * mirrors get-estimate.dto.ts — query-string values arrive as strings and
 * must be coerced before class-validator runs (NOT @Type, which does not
 * coerce raw query strings the same way).
 *
 * A NaN from a non-numeric `limit` is left undefined so the service applies
 * its DEFAULT_PAGE_SIZE fallback rather than failing validation on garbage.
 */
export class CatalogQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: string }) => {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? undefined : n;
  })
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}
