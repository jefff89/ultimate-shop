import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  AfterInsert,
  AfterUpdate,
  AfterRemove,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Role } from 'src/roles/role.entity';
import type { Address } from 'src/addresses/addresses.entity';
import type { Cart } from 'src/carts/carts.entity';
import type { Order } from 'src/orders/orders.entity';
import type { Report } from 'src/reports/report.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  email!: string;

  @Column()
  password!: string;

  @Column({ nullable: true })
  firstName?: string;

  @Column({ nullable: true })
  lastName?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany('Address', (address) => address.user)
  addresses!: Address[];

  @OneToMany('Cart', (cart) => cart.user)
  carts!: Cart[];

  @OneToMany('Order', (order) => order.user)
  orders!: Order[];

  @OneToMany('Report', (report) => report.user)
  reports!: Report[];

  // ✅ FIX: wrap Role in forwardRef to break circular dependency
  @ManyToMany('Role', (role) => role.users, {
    cascade: true,
    eager: true,
  })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'userId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'roleId', referencedColumnName: 'id' },
  })
  roles!: Role[];

  @AfterInsert()
  logInsert() {
    // console.log('Inserted User with id', this.id);
  }

  @AfterUpdate()
  logUpdate() {
    // console.log('Updated User with id', this.id);
  }

  @AfterRemove()
  logRemove() {
    // console.log('Removed User with id', this.id);
  }
}
