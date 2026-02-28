import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
// import { Transaction } from 'src/transactions/transaction.entity';
// import { OneToMany } from 'typeorm';

@Entity()
export class Report {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  price!: number;

  @Column()
  make!: string;

  @Column()
  model!: string;

  @Column()
  year!: number;

  @Column()
  lng!: number;

  @Column()
  lat!: number;

  @Column()
  mileage!: number;
}

// @OneToMany(() => Transaction, (transaction) => transaction.category)
// transactions: Transaction[]; // One to Many relation with transaction
