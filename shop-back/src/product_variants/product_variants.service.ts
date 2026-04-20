import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductVariant } from 'src/product_variants/product-variant.entity';

@Injectable()
export class ProductVariantsService {
  constructor(
    @InjectRepository(ProductVariant)
    private productVariantRepo: Repository<ProductVariant>,
  ) {}

  create(data: Partial<ProductVariant>) {
    const productVariant = this.productVariantRepo.create(data);
    return this.productVariantRepo.save(productVariant);
  }
}
