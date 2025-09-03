import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Platform } from '../shared/shared.const';
import { Order } from './order.entity'

@Entity({ name: 'order_items' })
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: Platform, nullable: false })
  platform: Platform;

  @Column({ type: 'varchar', length: 250, nullable: false })
  platform_item_id: string;

  @Column({ type: 'varchar', length: 250, nullable: true })
  sku?: string;

  @Column({ type: 'int', nullable: false })
  quantity: number;

  @Column({ type: 'float', nullable: false })
  total_price: number;

  @Column({ type: 'int', nullable: false })
  order_id: number;

  @ManyToOne(() => Order, { nullable: false })
  @JoinColumn({ name: 'order_id' })
  order: Order;
}