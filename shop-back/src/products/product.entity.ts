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

  @Column({ type: 'jsonb', nullable: true }) // custom attributes like brand, weight, dimensions
  attributes!: Record<string, any>; // Represents an object with string keys and values of any type.

  @ManyToOne('Category', (cat) => cat.products, {
    eager: false, // When loading a Product, do not automatically load the related Category. You must use relations or leftJoinAndSelect to fetch it.
  })
  category!: Category;

  @OneToMany('ProductVariant', (variant) => variant.product, {
    cascade: true, // When you save/remove a Product, automatically save/remove its related ProductVariant records. No need to manually call save on each variant.
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
