import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Customer } from './customer.entity';
import { Platform, Currency } from '../shared/shared.const';

@Entity({ name: 'orders' })
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: Platform, nullable: false })
  platform: Platform;

  @Column({ type: 'varchar', length: 250, nullable: false })
  platform_order_id: string;

  @Column({ type: 'timestamp', nullable: false })
  order_date: Date;

  @Column({ type: 'timestamp', nullable: false })
  payment_date: Date;

  @Column({ type: 'boolean', nullable: false })
  paid: boolean;

  @Column({ type: 'float', nullable: false })
  total_price: number;

  @Column({ type: 'float', nullable: false })
  total_delivery: number;

  @Column({ type: 'enum', enum: Currency, nullable: false })
  currency: Currency;

  @Column({ type: 'int', nullable: false })
  customer_id: number;

  @ManyToOne(() => Customer, { nullable: false })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ type: 'int', nullable: true })
  invoice_id?: number;
}