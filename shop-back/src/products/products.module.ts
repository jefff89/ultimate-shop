import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { ProductVariant } from 'src/product_variants/product-variant.entity';
import { Category, ProductTag } from 'src/categories/categories.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductVariant, Category, ProductTag, Product]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
