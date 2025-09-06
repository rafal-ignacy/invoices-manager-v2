import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import nodemailer, { Transporter } from 'nodemailer';
import { Customer } from 'src/entities/customer.entity';
import { IngService } from 'src/ing/ing.service';
import { RepositoriesService } from 'src/repositories/repositories.service';
import countries from "i18n-iso-countries";
import { Attachment } from './email.interface';
import outdent from 'outdent';

countries.registerLocale(require("i18n-iso-countries/langs/pl.json"));

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger: Logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(private ingService: IngService, private repositoriesService: RepositoriesService) { }

  onModuleInit() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USERNAME,
        pass: process.env.GMAIL_PASSWORD,
      },
    });
  }

  @OnEvent('invoices.created')
  async sendInvoices(invoiceIds: number[]) {
    this.logger.log('Sending email event');
    const invoicePdfs = await this.collectInvoices(invoiceIds);
    const customers = await this.collectCustomers(invoiceIds);

    if (invoicePdfs.length === 0) {
      this.logger.warn('No invoices downloaded, aborting email sending.');
      return;
    }

    const messageContent = this.prepareMessageContent(customers);
    await this.sendEmail(process.env.GMAIL_USERNAME!, 'Invoice', messageContent, invoicePdfs);
  }

  private async collectInvoices(invoiceIds: number[]): Promise<Attachment[]> {
    const invoicePdfs: Attachment[] = [];

    for (const invoiceId of invoiceIds) {
      const invoicePdf = await this.ingService.downloadInvoice(invoiceId);
      if (!invoicePdf) {
        this.logger.warn(`Cannot download invoice PDF for ID ${invoiceId}`);
        continue;
      }
      invoicePdfs.push({
        filename: `invoice_${invoiceId}.pdf`,
        content: invoicePdf,
        contentType: 'application/pdf',
      });
    }
    return invoicePdfs;
  }

  private async collectCustomers(invoiceIds: number[]): Promise<Customer[]> {
    const customers: Customer[] = [];

    for (const invoiceId of invoiceIds) {
      const customer = await this.repositoriesService.getCustomerByInvoiceId(invoiceId);
      if (!customer) {
        this.logger.warn(`Could not fetch customer details for invoice ID ${invoiceId}`);
        continue;
      }
      customers.push(customer);
    }
    return customers;
  }

  private prepareMessageContent(customers: Customer[]) {
    return customers.map((cust) => {
      return outdent`
      ${cust.full_name}
      ${cust?.address_street ?? ''}
      ${cust?.postal_code ?? ''} ${cust?.city ?? ''}
      ${countries.getName(cust.country_code!, 'pl') ?? ''}
      `.trim();
    }).join('\n\n');
  }

  private async sendEmail(to: string, subject: string, text: string,attachments: Attachment[]) {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.GMAIL_USERNAME,
        to,
        subject,
        text,
        attachments,
      });
      this.logger.log(`Email sent: ${info.response}`);
    } catch (error) {
      this.logger.error('Error during email sending', error);
      throw error;
    }
  }
}