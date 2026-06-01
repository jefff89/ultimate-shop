import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dtos/create-product-dto';
import { JwtAuthGuard } from 'src/users/auth/guards/jwt-auth.guard';
import { AdminGuard } from 'src/guards/admin.gurad';

@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createProduct(@Body() body: CreateProductDto) {
    await this.productsService.create(body);
  }
}
