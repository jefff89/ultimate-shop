import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { Tag } from 'src/tags/tags.entity';
import { Category } from 'src/categories/categories.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Tag) private tagRepo: Repository<Tag>,
    @InjectRepository(Category) private categoryRepo: Repository<Category>,
  ) {}

  async create(
    data: Partial<Product> & { tagIds?: string[]; categoryId?: string },
  ) {
    const { tagIds, categoryId, ...productData } = data;

    const product = this.productRepo.create(productData);

    // Load category if provided
    if (categoryId) {
      product.category = await this.categoryRepo.findOneBy({ id: categoryId });
    }

    // Load tags if provided
    if (tagIds && tagIds.length > 0) {
      product.tags = await this.tagRepo.findByIds(tagIds);
    }

    return this.productRepo.save(product);
  }
}
