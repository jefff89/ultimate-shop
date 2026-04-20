import { Injectable } from '@nestjs/common';
import { Category, ProductTag } from './categories.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private categoryRepo: Repository<Category>,
    @InjectRepository(ProductTag)
    private productTagRepo: Repository<ProductTag>,
  ) {}

  create(data: Partial<Category>) {
    const category = this.categoryRepo.create(data);
    return this.categoryRepo.save(category);
  }
  createTag(name: string) {
    const tag = this.productTagRepo.create({ name });
    return this.productTagRepo.save(tag);
  }
}
