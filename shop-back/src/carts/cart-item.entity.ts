import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ValueTransformer,
  Check,
} from 'typeorm';
import { Cart } from './carts.entity';
import type { Product } from 'src/products/product.entity';
import type { ProductVariant } from 'src/product_variants/product-variant.entity';

const decimalTransformer: ValueTransformer = {
  to: (value: number | string | null) => (value === null ? null : value),
  from: (value: string | null) => (value === null ? null : parseFloat(value)),
};

@Entity()
@Check('CHK_cartitem_quantity_positive', 'quantity > 0')
@Index(['cartId', 'productId', 'variantId'], { unique: true })
@Index(['productId'])
@Index(['variantId'])
@Index(['cartId'])
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  cartId!: string;

  @ManyToOne('Cart', (cart) => cart.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cartId' })
  cart!: Cart;

  @Column({ type: 'uuid' })
  productId!: string;

  @ManyToOne('Product', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'productId' })
  product?: Product;

  @Column({ type: 'uuid', nullable: true })
  variantId!: string | null;

  @ManyToOne('ProductVariant', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'variantId' })
  variant?: ProductVariant | null;

  @Column({ type: 'int', default: 1 })
  quantity!: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  unitPrice!: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  discountPrice!: number | null; // optional discount applied to this item

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
