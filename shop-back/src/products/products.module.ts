import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { ProductVariant } from 'src/product_variants/product-variant.entity';
import { Category } from 'src/categories/categories.entity';
import { Tag } from 'src/tags/tags.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductVariant, Category, Tag, Product])],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
