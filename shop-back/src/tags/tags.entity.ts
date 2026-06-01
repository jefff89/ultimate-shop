import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { Product } from 'src/products/product.entity';
import { Category } from 'src/categories/categories.entity';

@Entity()
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  name!: string;

  @ManyToMany('Product', (product: Product) => product.tags)
  products!: Product[];

  @ManyToMany('Category', (category: Category) => category.tags)
  categories!: Category[];
}
