import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CreateCategoryDto } from './dtos/create-category-dto';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from 'src/users/auth/guards/jwt-auth.guard';
import { AdminGuard } from 'src/guards/admin.gurad';

@Controller('categories')
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createCategory(@Body() body: CreateCategoryDto) {
    await this.categoriesService.create(body);
  }
}
