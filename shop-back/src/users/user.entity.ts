import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  AfterInsert,
  AfterUpdate,
  AfterRemove,
  // OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
// import { Report } from 'src/reports/report.entity';
import { Role } from 'src/roles/role.entity';
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  email!: string;

  @Column()
  password!: string;

  // @Column({ default: true })
  // admin!: boolean;
  @Column({ nullable: true })
  firstName?: string;

  @Column({ nullable: true })
  lastName?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // @OneToMany('Address', (address) => address.user)
  // addresses!: Address[];

  @ManyToMany('Role', (role) => role.user, {
    cascade: true, // optional: creates/updates join rows automatically
    eager: true, // set true only if you always need roles loaded
  })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'userId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'roleId', referencedColumnName: 'id' },
  })
  roles!: Role[];

  // @OneToMany(() => Report, (report) => report.user)
  // @OneToMany('Report', (report) => report.user)
  // reports!: Report[];

  // @OneToMany(() => Transaction, (transaction) => transaction.category)
  // transactions: Transaction[]; // One to Many relation with transaction

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
