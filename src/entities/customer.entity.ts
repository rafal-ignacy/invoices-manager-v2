import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { CountryCode } from '../shared/shared.const';

@Entity({ name: 'customers' })
export class Customer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  username?: string;

  @Column({ type: 'text', nullable: false })
  full_name: string;

  @Column({ type: 'text', nullable: true })
  address_street?: string;

  @Column({ type: 'text', nullable: true })
  city?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  postal_code?: string;

  @Column({ type: 'enum', enum: CountryCode, nullable: true })
  country_code?: CountryCode;
}