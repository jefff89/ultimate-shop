// address.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from '../users/user.entity';

@Entity()
export class Address {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne('User', (user) => user.addresses, {
    onDelete: 'CASCADE',
  })
  user!: User; // which user owns this address

  @Column({ length: 100 })
  firstName!: string;

  @Column({ length: 100 })
  lastName!: string;

  @Column({ length: 20, nullable: true })
  phone!: string;

  @Column({ length: 255 })
  street!: string;

  @Column({ length: 100, nullable: true })
  apartment!: string; // suite, unit, etc.

  @Column({ length: 100 })
  city!: string;

  @Column({ length: 50 })
  state!: string;

  @Column({ length: 20 })
  postalCode!: string;

  @Column({ length: 100 })
  country!: string;

  @Column({
    type: 'enum',
    enum: ['shipping', 'billing', 'both'],
    default: 'both',
  })
  // for postgress
  // @Column()
  // type!: string;
  @Column({ default: false })
  isDefault!: boolean;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, any>; // delivery instructions, etc.

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
