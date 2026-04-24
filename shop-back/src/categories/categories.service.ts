// categories.service.ts
import { Injectable } from '@nestjs/common';
import { Category } from './categories.entity';
import { Tag } from 'src/tags/tags.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private categoryRepo: Repository<Category>,
    @InjectRepository(Tag) private tagRepo: Repository<Tag>,
  ) {}

  async create(data: Partial<Category> & { tagIds?: string[] }) {
    const { tagIds, ...categoryData } = data;

    const category = this.categoryRepo.create(categoryData);

    // Load tags if provided
    if (tagIds && tagIds.length > 0) {
      category.tags = await this.tagRepo.findByIds(tagIds);
    }

    return this.categoryRepo.save(category);
  }
}
