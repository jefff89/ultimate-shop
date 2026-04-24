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
  JoinTable,
} from 'typeorm';
import { Product } from 'src/products/product.entity';
import { Tag } from 'src/tags/tags.entity';

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

  @ManyToMany('Tag', (tag) => tag.categories)
  @JoinTable({
    name: 'category_tags',
    joinColumn: { name: 'categoryId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tagId', referencedColumnName: 'id' },
  })
  tags!: Tag[];
}
