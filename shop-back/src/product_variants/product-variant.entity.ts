// product-variant.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
} from 'typeorm';
import { Product } from 'src/products/product.entity';

@Entity()
@Index(['sku'], { unique: true })
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  sku!: string; // stock keeping unit

  //   @Column({ type: 'jsonb' })
  // e.g., { size: 'M', color: 'Red' }
  @Column({ type: 'jsonb', nullable: true })
  options!: Record<string, any>;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  compareAtPrice!: number; // for showing discounts

  @Column({ type: 'int', default: 0 })
  stock!: number;

  @Column({ type: 'int', default: 0 })
  reservedStock!: number; // for pending orders

  @Column({ default: true })
  isActive!: boolean;

  @ManyToOne('Product', (product) => product.variants, {
    onDelete: 'CASCADE',
  })
  product!: Product;

  @Column({ type: 'simple-array', nullable: true })
  imageIds!: string[]; // specific images for this variant
}
