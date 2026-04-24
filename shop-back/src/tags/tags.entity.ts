import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { Product } from 'src/products/product.entity';
import { Category } from 'src/categories/categories.entity';

@Entity()
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  name!: string;

  @ManyToMany('Product', (product) => product.tags)
  products!: Product[];

  @ManyToMany('Category', (category) => category.tags)
  categories!: Category[];
}
