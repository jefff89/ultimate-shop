// product.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  ManyToMany,
  JoinTable,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ProductVariant } from '../product_variants/product-variant.entity';
import type { Category } from '../categories/categories.entity';
import type { Tag } from 'src/tags/tags.entity';

@Entity()
@Index(['name', 'slug'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ unique: true })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  basePrice!: number; // optional, can be overridden by variants

  @Column({ type: 'int', default: 0 })
  totalStock!: number; // aggregate from variants

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  attributes!: Record<string, any>; // custom attributes like brand, weight, dimensions

  @ManyToOne('Category', (cat) => cat.products, {
    eager: false,
  })
  category!: Category;

  @OneToMany('ProductVariant', (variant) => variant.product, {
    cascade: true,
  })
  variants!: ProductVariant[];

  @ManyToMany('Tag', (tag) => tag.products)
  @JoinTable({
    name: 'product_tags',
    joinColumn: { name: 'productId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tagId', referencedColumnName: 'id' },
  })
  tags!: Tag[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
