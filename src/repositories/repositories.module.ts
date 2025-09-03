import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RepositoriesService } from './repositories.service';
import { Order } from 'src/entities/order.entity';
import { Customer } from 'src/entities/customer.entity';
import { OrderItem } from 'src/entities/order_item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Customer, OrderItem])],
  providers: [RepositoriesService],
  exports: [RepositoriesService]
})
export class RepositoriesModule { }
