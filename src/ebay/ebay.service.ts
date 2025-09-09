import { Injectable, Logger, OnModuleInit, HttpStatus } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { RepositoriesService } from 'src/repositories/repositories.service';
import { ShipTo, LineItem } from './ebay.interfaces'
import { Customer } from 'src/entities/customer.entity';
import { CountryCode, Platform } from 'src/shared/shared.const';
import { OrderItem } from 'src/entities/order_item.entity';
import { Order } from 'src/entities/order.entity';
import { CurrencyMarketplaceMap } from './ebay.const';

@Injectable()
export class EbayService implements OnModuleInit {
  private readonly logger = new Logger(EbayService.name);
  private accessToken: string;
  private accessTokenExpiringTime: number;

  constructor(private readonly repositoriesService: RepositoriesService) { }

  async onModuleInit() {
    this.getOrders();
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  private async getOrders() {
    this.logger.log('Fetching eBay orders...');

    if (this.accessTokenNeedsRefreshing()) {
      const result = await this.getAccessTokenFromRefreshToken(process.env.EBAY_REFRESH_TOKEN!, process.env.EBAY_CLIENT_ID!, process.env.EBAY_CLIENT_SECRET!, process.env.EBAY_SCOPE!);
      if (!result) {
        this.logger.warn('Could not fetch eBay orders because access token was not refreshed');
        return;
      }
    }

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoIsoDate = threeDaysAgo.toISOString();

    const params = {
      'filter': `creationdate:[${threeDaysAgoIsoDate}..]`
    };
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`
    };

    try {
      const response = await axios.get('https://api.ebay.com/sell/fulfillment/v1/order', { params: params, headers: headers });
      if (response.status !== HttpStatus.OK) {
        this.logger.warn('Could not fetch eBay orders details');
        return;
      }

      this.logger.log(`Successfully fetched eBay orders details. Total amount: ${response.data.total}`);
      if (response.data.total > 0) {
        this.processEbayOrders(response.data.orders);
        return;
      }

    } catch (error) {
      this.logger.error('Error when trying to fetch eBay orders details', error);
    };
  }

  private accessTokenNeedsRefreshing(): boolean {
    return !this.accessToken || this.accessTokenExpiringTime < Date.now();
  }

  private async getAccessTokenFromRefreshToken(refresh_token: string, clientId: string, clientSecret: string, scope: string): Promise<boolean | undefined> {
    const scopeParsed = JSON.parse(scope);
    const base64EncodedOAuthCredentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const data = { 'grant_type': 'refresh_token', 'refresh_token': refresh_token, 'scope': scopeParsed };
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${base64EncodedOAuthCredentials}`
    };

    try {
      const response = await axios.post('https://api.ebay.com/identity/v1/oauth2/token', data, {
        headers: headers
      });

      if (response.status !== HttpStatus.OK) {
        this.logger.warn('Could not obtain access token from refresh token');
        return false;
      }

      this.logger.log('Successfully obtained access token from refresh token');
      this.accessToken = response.data?.access_token;
      this.accessTokenExpiringTime = Date.now() + response.data?.expires_in * 1000;
      return true;
    } catch (error) {
      this.logger.error('Error when trying to obtain access token from refresh token: ', error);
    }
  }

  private async processEbayOrders(orders: any[]) {
    this.logger.log('Processing eBay orders...');
    for (const order of orders) {
      const existingOrder = await this.repositoriesService.getOrderByPlatformOrderId(order.orderId);

      if (existingOrder && order.orderPaymentStatus === 'PAID' && !existingOrder.paid) {
        this.logger.log('Marking order as paid...');
        this.setOrderAsPaid(order.orderId, order.paymentSummary.payments[0]?.paymentDate);
        continue;
      } else if (!existingOrder) {
        this.logger.log('Adding order to database...');
        this.addOrderToDatabase(order);
        continue;
      }
      this.logger.log(`Skipping order ${order.orderId} (customer: ${order.buyer.buyerRegistrationAddress.fullName}) because it already exists in database`);
    }
  }

  private async setOrderAsPaid(platformOrderId: string, paymentDateIsoString: string) {
    const paymentDate = new Date(paymentDateIsoString);
    if (isNaN(paymentDate.getTime())) {
      this.logger.warn('Payment date is wrong');
    }

    this.repositoriesService.setOrderAsPaid(platformOrderId, paymentDate);
    this.logger.log(`Successfully set order ${platformOrderId} as paid`);
  }

  private async addOrderToDatabase(order: any) {
    const customer = this.prepareCustomerDetails(order.fulfillmentStartInstructions[0].shippingStep.shipTo, order.buyer.username);
    const orderItems = this.prepareOrderItemsDetails(order.lineItems);
    const orderDetails = this.prepareOrderDetails(order);

    if(!customer || !orderItems || !orderDetails) {
      this.logger.warn('Cannot add to database, incomplete data');
      return;
    }
    const customerId = await this.repositoriesService.addCustomerToDatabase(customer);
    this.logger.log(`Successfully added customer ${customer.full_name} to database`);

    orderDetails.customer_id = customerId;
    const orderId = await this.repositoriesService.addOrderToDatabase(orderDetails);
    this.logger.log(`Successfully added order ${orderDetails.platform_order_id} to database`);

    orderItems.forEach(item => item.order_id = orderId);
    await this.repositoriesService.addOrderItemsToDatabase(orderItems);
    this.logger.log(`Successfully added ${orderItems.length} order items to database: ${orderItems.map(item => `SKU: ${item.sku || 'N/A'}`).join(', ')}`);
  }

  private prepareCustomerDetails(customerDetails: ShipTo, username: string): Customer {
    const customer = new Customer();

    customer.username = username;
    customer.full_name = customerDetails.fullName;
    customer.address_street = customerDetails.contactAddress.addressLine1;

    if (customerDetails.contactAddress.addressLine2) {
      customer.address_street += ` ${customerDetails.contactAddress.addressLine2}`;
    }

    const { stateOrProvince, postalCode, city, countryCode } = customerDetails.contactAddress;

    if (stateOrProvince) {
      if (countryCode === CountryCode.US) {
        customer.postal_code = `${stateOrProvince} ${postalCode}`;
        customer.city = city;
      } else {
        customer.postal_code = postalCode;
        customer.city = `${city}, ${stateOrProvince}`;
      }
    } else {
      customer.postal_code = postalCode;
      customer.city = city;
    }

    customer.country_code = countryCode as CountryCode;

    return customer;
  }

  private prepareOrderItemsDetails(lineItems: LineItem[]): OrderItem[] {
    const orderItems: OrderItem[] = [];
    lineItems.forEach(item => {
      const orderItem = new OrderItem();

      orderItem.platform = item.listingMarketplaceId as Platform;
      orderItem.platform_item_id = item.legacyItemId;
      orderItem.sku = item.sku || undefined;
      orderItem.quantity = item.quantity;
      orderItem.total_price = item.lineItemCost.value;

      orderItems.push(orderItem);
    });
    return orderItems;
  }

  private prepareOrderDetails(orderDetails: any): Order {
    const order = new Order();

    order.platform = CurrencyMarketplaceMap[orderDetails.pricingSummary.total.currency];
    order.platform_order_id = orderDetails.orderId;
    order.order_date = new Date(orderDetails.creationDate);
    order.payment_date = new Date(orderDetails.paymentSummary.payments[0].paymentDate) || null;
    order.paid = orderDetails.orderPaymentStatus === 'PAID' ? true : false;
    order.total_price = orderDetails.pricingSummary.total.value;
    order.total_delivery = orderDetails.pricingSummary.deliveryCost.value;
    order.currency = orderDetails.pricingSummary.total.currency;

    return order;
  }
}

