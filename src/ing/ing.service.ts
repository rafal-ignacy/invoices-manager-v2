import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import axios from 'axios';
import { Order } from 'src/entities/order.entity';
import { RepositoriesService } from 'src/repositories/repositories.service';
import { IngInvoiceFields } from './ing.const';
import { BuyerDto, PositionDto, PaymentDto, CurrencyDto, InvoiceDto } from './ing.interfaces';
import { Currency } from 'src/shared/shared.const';
import * as PositionTypesNames from 'data/position_types.json';

@Injectable()
export class IngService implements OnModuleInit {
  private readonly logger = new Logger(IngService.name);

  constructor(
    private readonly repositoriesService: RepositoriesService,
    private eventEmitter: EventEmitter2
  ) { }

  onModuleInit() {
    this.createInvoices();
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  private async createInvoices() {
    const orders = await this.repositoriesService.getPaidOrdersWithoutInvoice();
    
    if(orders.length === 0){
      return;
    }

    this.logger.log(`Successfully fetched ${orders.length} paid orders without invoice from the database`);

    let invoiceIds: number[] = [];
    for (const order of orders) {
      const invoicePayload = await this.prepareInvoicePayload(order);

      if (!invoicePayload) {
        continue;
      }
      this.logger.log(`Prepared ${invoiceIds.length + 1} of ${orders.length} invoices payload`);
      const invoiceId = await this.createInvoice(invoicePayload);

      if (!invoiceId) {
        continue;
      }

      this.repositoriesService.addInvoiceId(order.id, invoiceId);
      invoiceIds.push(invoiceId);
      this.logger.log('Successfully saved invoice ID');
    }

    if (invoiceIds.length > 0) {
      this.eventEmitter.emit('invoices.created', invoiceIds);
    }
  }

  private async prepareInvoicePayload(order: Order): Promise<InvoiceDto | undefined> {
    const currency = await this.prepareCurrency(order.payment_date, order.currency);
    const payment = this.preparePayment(order.payment_date, order.total_price);
    const buyer = await this.prepareBuyer(order.customer_id);
    const positions = await this.preparePositions(order.id, order.total_delivery);

    if (!currency || !payment || !buyer || !positions || positions.length === 0) {
      this.logger.warn(`Cannot make an invoice - missing data - buyer: ${buyer}, currency: ${currency}, payment: ${payment}, positions: ${positions}`);
      this.repositoriesService.addInvoiceId(order.id, 0);
      return;
    }

    return {
      issuePlace: IngInvoiceFields.ISSUE_PLACE,
      issueDate: this.formatDate(new Date()),
      serviceDate: this.formatDate(order.payment_date),
      description: IngInvoiceFields.DESCRIPTION,
      currency: currency,
      payment: payment,
      buyer: buyer,
      positions: positions
    }
  }

  private async prepareBuyer(customerId: number): Promise<BuyerDto | undefined> {
    const customer = await this.repositoriesService.getCustomer(customerId);

    if (!customer) {
      this.logger.warn(`Could not find customer with ID: ${customerId}`);
      return;
    }

    return {
      email: IngInvoiceFields.EMAIL,
      fullName: customer.full_name,
      addressStreet: customer.address_street!,
      city: customer.city!,
      postCode: customer.postal_code!,
      countryCode: customer.country_code!,
      taxNumber: IngInvoiceFields.HYPEN,
      taxCountryCode: customer.country_code!
    }
  }

  private async preparePositions(orderId: number, shippingPrice: number): Promise<PositionDto[] | undefined> {
    const orderedItems = await this.repositoriesService.getOrderItems(orderId);

    if (!orderedItems) {
      this.logger.warn(`Could not find any items for order ID: ${orderId}`);
      return;
    }

    const positions = orderedItems
      .filter(item => item.sku)
      .map(item => {
        const positionName = this.getPositionName(item.sku!);
        if (!positionName) {
          return null;
        }

        return {
          name: positionName,
          code: this.getSkuWithoutPlatform(item.sku!),
          quantity: item.quantity,
          unit: IngInvoiceFields.UNIT,
          net: item.total_price,
          gross: item.total_price,
          taxStake: IngInvoiceFields.TAX_STAKE
        };
      })
      .filter(position => position !== null);

    if (positions.length >= 1) {
      positions.push({
        name: PositionTypesNames.SHIPPING,
        code: IngInvoiceFields.HYPEN,
        quantity: 1,
        unit: IngInvoiceFields.UNIT,
        net: shippingPrice,
        gross: shippingPrice,
        taxStake: IngInvoiceFields.TAX_STAKE
      });
    }
    return positions;
  }

  private getPositionName(sku: string): string | undefined {
    const positionType = sku.match(/\d*([A-Z]{2,})\b/);
    if (positionType) {
      return PositionTypesNames[positionType[1]];
    }
    return undefined;
  }

  private getSkuWithoutPlatform(sku: string): string {
    return sku.replace(/-[A-Z]{2}$/, "");
  }

  private preparePayment(paymentDate: Date, totalPrice: number): PaymentDto {
    const paymentDateFormatted = this.formatDate(paymentDate);

    return {
      method: IngInvoiceFields.OTHER,
      deadlineDate: paymentDateFormatted,
      paidAmount: totalPrice
    }
  }

  private async prepareCurrency(paymentDate: Date, currency: Currency): Promise<CurrencyDto | null> {
    let paymentDateLocal = new Date(paymentDate);
    paymentDateLocal.setDate(paymentDateLocal.getDate() - 1);

    while (true) {
      const date = this.formatDate(paymentDateLocal);
      const url = `https://api.nbp.pl/api/exchangerates/rates/a/${currency}/${date}/?format=json`;

      try {
        const response = await fetch(url);
        if (response.ok) {
          const rate = await response.json();
          return {
            rate: rate.rates[0].mid,
            code: currency
          }
        } else {
          paymentDateLocal.setDate(paymentDateLocal.getDate() - 1);
        }
      } catch (error) {
        this.logger.error('Error during fetching exchange rate');
        return null;
      }
    }
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private async createInvoice(data: InvoiceDto): Promise<number | undefined> {
    try {
      const response = await axios.post('https://ksiegowosc.ing.pl/v2/api/public/create-invoice', data, { headers: this.getIngRequestHeaders() });
      if (response.status === 200) {
        this.logger.log('Successfully created an invoice in ING Księgowość');
        const invoiceId = response.data.id;
        return invoiceId;
      }
      this.logger.warn('Could not create the invoice in ING Księgowość')
    } catch (error) {
      this.logger.error('Error during creating the invoice: ', error.response.data);
    }
  }

  async downloadInvoice(invoiceId: number): Promise<Buffer | undefined> {
    try {
      const response = await axios.get(`https://ksiegowosc.ing.pl/v2/api/public/download-invoice/${invoiceId}/pdf`, {
        responseType: 'arraybuffer',
        headers: this.getIngRequestHeaders(),
      });
      if (response.status === 200) {
        this.logger.log('Successfully downloaded an invoice from ING Księgowość');
        return Buffer.from(response.data);
      }
      this.logger.warn('Could not download the invoice from ING Księgowość')
    } catch (error) {
      console.error('Error during downloading the invoice:', error.response.data);
    }
  }

  private getIngRequestHeaders() {
    return {
      'ApiUserCompanyRoleKey': process.env.ING_KSIEGOWOSC_API_KEY!,
      'Content-Type': 'application/json'
    }
  }
}
