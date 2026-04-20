import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { Category, ProductTag } from './categories.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Category, ProductTag])],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  // exports: [CategoriesService],
})
export class CategoriesModule {}
