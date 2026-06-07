import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dtos/create-product-dto';
import { CatalogQueryDto } from './dtos/catalog-query.dto';
import { JwtAuthGuard } from 'src/users/auth/guards/jwt-auth.guard';
import { AdminGuard } from 'src/guards/admin.gurad';
import { InvalidCursorError } from '@shared/cursor';

@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  // Public catalog read (Security V2 — no guard). A tampered/garbage cursor
  // surfaces as a 400, not a malformed query or an empty 200 (T-06-01).
  // NOTE: deliberately NO @Get('/:id') here — the rail routes land in Plan 02
  // and a bare :id param would shadow them.
  @Get()
  async list(@Query() query: CatalogQueryDto) {
    try {
      return await this.productsService.findCatalogPage(query);
    } catch (err) {
      if (err instanceof InvalidCursorError) {
        throw new BadRequestException('invalid cursor');
      }
      throw err;
    }
  }

  // Public feed-rail reads (Security V2 — no guard). Static path segments, so
  // they do NOT collide with the parameter-less base @Get() list above. Each
  // returns a plain, bounded array structurally separate from the cursor stream
  // (CAT-04). The global ThrottlerGuard rate-limits these (T-06-05). The `limit`
  // query param is re-clamped inside the service via boundRailLimit.
  @Get('featured')
  async featured(@Query('limit') limit?: string) {
    return this.productsService.findFeaturedProducts({
      limit: limit != null ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('trending')
  async trending(@Query('limit') limit?: string) {
    return this.productsService.findTrendingProducts({
      limit: limit != null ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('categories')
  async categories() {
    return this.productsService.findCategories();
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createProduct(@Body() body: CreateProductDto) {
    await this.productsService.create(body);
  }
}
