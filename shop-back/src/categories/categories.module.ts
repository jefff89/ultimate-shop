import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { Category } from './categories.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tag } from 'src/tags/tags.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Tag])],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  // exports: [CategoriesService],
})
export class CategoriesModule {}
