interface ContactAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateOrProvince?: string;
  postalCode?: string;
  countryCode: string;
}

interface PrimaryPhone {
  phoneNumber: string;
}

export interface ShipTo {
  fullName: string;
  contactAddress: ContactAddress;
  primaryPhone?: PrimaryPhone;
  email?: string;
}

interface LineItemCost {
  value: number;
  currency: string;
}

export interface LineItem {
  lineItemId: number;
  legacyItemId: string;
  sku?: string;
  title: string;
  lineItemCost: LineItemCost;
  quantity: number;
  soldFormat: string;
  listingMarketplaceId: string;
  purchaseMarketplaceId: string;
  lineItemFulfillmentStatus: string;
}