import { Body, Controller, Post } from '@nestjs/common';
import { CreateCategoryDto } from './dtos/create-category-dto';
import { CategoriesService } from './categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Post()
  async createCategory(@Body() body: CreateCategoryDto) {
    await this.categoriesService.create(body);
  }
}
