import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from 'src/entities/customer.entity';
import { Order } from 'src/entities/order.entity';
import { OrderItem } from 'src/entities/order_item.entity';

@Injectable()
export class RepositoriesService {

  constructor(
    @InjectRepository(Order) private readonly ordersRepository: Repository<Order>,
    @InjectRepository(Customer) private readonly customersRepository: Repository<Customer>,
    @InjectRepository(OrderItem) private readonly orderItemsRepository: Repository<OrderItem>,
  ) { }

  async getOrderByPlatformOrderId(platformOrderId: string): Promise<Order | null> {
    return await this.ordersRepository.findOne({ where: { platform_order_id: platformOrderId } });
  }

  async setOrderAsPaid(platformOrderId: string, paymentDate: Date): Promise<void> {
    this.ordersRepository.update({ platform_order_id: platformOrderId }, { payment_date: paymentDate, paid: true });
  }

  async addCustomerToDatabase(customer: Customer): Promise<number> {
    const savedCustomer = await this.customersRepository.save(customer);
    return savedCustomer.id;
  }

  async addOrderToDatabase(order: Order): Promise<number> {
    const savedOrder = await this.ordersRepository.save(order);
    return savedOrder.id;
  }

  async addOrderItemsToDatabase(orderItems: OrderItem[]): Promise<void> {
    for(const item of orderItems) {
      await this.orderItemsRepository.save(item);
    }
  }
}