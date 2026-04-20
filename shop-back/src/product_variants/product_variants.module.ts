import { Module } from '@nestjs/common';
import { ProductVariantsController } from './product_variants.controller';
import { ProductVariantsService } from './product_variants.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductVariant } from './product-variant.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductVariant])],
  controllers: [ProductVariantsController],
  providers: [ProductVariantsService],
})
export class ProductVariantsModule {}
