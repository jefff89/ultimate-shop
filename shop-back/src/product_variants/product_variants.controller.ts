import { Body, Controller, Post } from '@nestjs/common';
import { ProductVariantsService } from './product_variants.service';
import { CreateProductVariantDto } from 'src/product_variants/dtos/create-product-variants-dto';

@Controller('product-variants')
export class ProductVariantsController {
  constructor(private productVariantsService: ProductVariantsService) {}

  @Post()
  async createProductVariant(@Body() body: CreateProductVariantDto) {
    await this.productVariantsService.create(body);
  }
}
