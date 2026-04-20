import { Body, Controller, Post } from '@nestjs/common';
import { CreateCategoryDto } from './dtos/create-category-dto';
import { CategoriesService } from './categories.service';
import { CreateProductTagDto } from './dtos/create-product-tag-dto';

@Controller('categories')
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Post()
  async createCategory(@Body() body: CreateCategoryDto) {
    await this.categoriesService.create(body);
  }
  @Post('tags')
  async createTag(@Body() body: CreateProductTagDto) {
    await this.categoriesService.createTag(body.name);
  }
}
