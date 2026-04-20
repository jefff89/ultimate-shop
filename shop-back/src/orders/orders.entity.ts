import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  ValueTransformer,
  Index,
  Check,
} from 'typeorm';
import { Address } from '../addresses/addresses.entity';
import type { Product } from 'src/products/product.entity';
import type { ProductVariant } from 'src/product_variants/product-variant.entity';

const decimalTransformer: ValueTransformer = {
  to: (value: number | string | null) => (value === null ? null : value),
  from: (value: string | null) => (value === null ? null : parseFloat(value)),
};

@Entity()
@Index(['userId', 'status'])
@Check('CHK_order_total_non_negative', 'totalAmount >= 0')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne('User', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user?: import('src/users/user.entity').User | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalAmount!: number;

  @Column({ type: 'varchar', length: 20 })
  status!: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

  @Column({ type: 'json' })
  shippingAddress!: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };

  @Column({ type: 'varchar', nullable: true })
  trackingNumber!: string;

  @OneToMany('OrderLineItem', (lineItem) => lineItem.order, {
    cascade: true,
  })
  lineItems!: OrderLineItem[];

  @ManyToOne('Address')
  @JoinColumn({ name: 'billing_address_id' })
  billingAddress!: Address;

  // If you want a frozen snapshot at order time (optional):
  @Column({ type: 'json', nullable: true })
  shippingAddressSnapshot!: object; // backup in case address later deleted

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

// order-line-item.entity.ts
@Entity()
@Check('CHK_orderline_quantity_positive', 'quantity > 0')
@Index(['order'])
@Index(['productId'])
@Index(['variantId'])
export class OrderLineItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Order, (order) => order.lineItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

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

  @Column({ type: 'int' })
  quantity!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  unitPrice!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalPrice!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
