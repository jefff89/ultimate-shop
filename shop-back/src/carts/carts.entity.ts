import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { CartItem } from './cart-item.entity';
import type { User } from 'src/users/user.entity';

@Entity()
@Index(['userId'], { unique: true })
export class Cart {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @OneToMany('CartItem', (item) => item.cart, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  items!: CartItem[];

  @Column({ type: 'varchar', nullable: true })
  paymentIntentId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
