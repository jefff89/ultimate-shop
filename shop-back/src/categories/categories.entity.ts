// category.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Tree,
  TreeChildren,
  TreeParent,
  ManyToMany,
  OneToMany,
} from 'typeorm';
import { Product } from 'src/products/product.entity';

@Entity()
@Tree('closure-table') // PostgreSQL/MySQL closure table support
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ unique: true })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @TreeChildren()
  children!: Category[];

  @TreeParent()
  parent!: Category;

  // products in this category
  @OneToMany('Product', (product) => product.category)
  products!: Product[];
}

// product-tag.entity.ts
@Entity()
export class ProductTag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  name!: string;

  @ManyToMany('Product', (product) => product.tags)
  products!: Product[];
}
