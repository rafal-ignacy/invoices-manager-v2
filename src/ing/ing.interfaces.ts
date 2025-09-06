import { CountryCode, Currency } from '../shared/shared.const';
import { IngInvoiceFields } from './ing.const';

export interface BuyerDto {
  email: string;
  fullName: string;
  addressStreet: string;
  city: string;
  postCode: string;
  countryCode: CountryCode;
  taxNumber: string;
  taxCountryCode: CountryCode;
}

export interface PositionDto {
  name: string;
  code: string;
  quantity: number;
  unit: IngInvoiceFields;
  net: number;
  gross: number;
  taxStake: IngInvoiceFields;
}

export interface PaymentDto {
  method: string;
  deadlineDate: string;
  paidAmount: number;
}

export interface CurrencyDto {
  code: Currency,
  rate: number;
}

export interface InvoiceDto {
  issuedGross?: boolean,
  issuePlace?: string, 
  issueDate?: string,
  serviceDate?: string,
  description?: string,
  signature?: string,
  currency?: CurrencyDto,
  payment: PaymentDto,
  buyer: BuyerDto,
  positions: PositionDto[]
}