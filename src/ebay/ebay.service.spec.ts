import { Test, TestingModule } from '@nestjs/testing';
import { EbayService } from './ebay.service';
import { RepositoriesService } from 'src/repositories/repositories.service';
import { Logger } from '@nestjs/common';
import { BuyerRegistrationAddress, LineItem } from './ebay.interfaces';
import { Customer } from 'src/entities/customer.entity';
import { Order } from 'src/entities/order.entity';
import { OrderItem } from 'src/entities/order_item.entity';
import { CountryCode, Platform } from 'src/shared/shared.const';
import { CurrencyMarketplaceMap } from './ebay.const';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock environment variables
const mockEnv = {
  EBAY_REFRESH_TOKEN: 'mock_refresh_token',
  EBAY_CLIENT_ID: 'mock_client_id',
  EBAY_CLIENT_SECRET: 'mock_client_secret',
  EBAY_SCOPE: '["https://api.ebay.com/oauth/api_scope/sell.fulfillment"]'
};

Object.assign(process.env, mockEnv);

describe('EbayService', () => {
  let service: EbayService;
  let repositoriesService: RepositoriesService;

  const mockRepositoriesService = {
    getOrderByPlatformOrderId: jest.fn(),
    setOrderAsPaid: jest.fn(),
    addCustomerToDatabase: jest.fn(),
    addOrderToDatabase: jest.fn(),
    addOrderItemsToDatabase: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EbayService,
        {
          provide: RepositoriesService,
          useValue: mockRepositoriesService,
        },
      ],
    }).compile();

    service = module.get<EbayService>(EbayService);
    repositoriesService = module.get<RepositoriesService>(RepositoriesService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should call getOrders on module initialization', async () => {
      const getOrdersSpy = jest.spyOn(service as any, 'getOrders').mockResolvedValue(undefined);
      
      await service.onModuleInit();
      
      expect(getOrdersSpy).toHaveBeenCalled();
    });
  });

  describe('accessTokenNeedsRefreshing', () => {
    it('should return true when access token is not set', () => {
      (service as any).accessToken = undefined;
      (service as any).accessTokenExpiringTime = 0;
      
      const result = (service as any).accessTokenNeedsRefreshing();
      
      expect(result).toBe(true);
    });

    it('should return true when access token is expired', () => {
      (service as any).accessToken = 'mock_token';
      (service as any).accessTokenExpiringTime = Date.now() - 1000;
      
      const result = (service as any).accessTokenNeedsRefreshing();
      
      expect(result).toBe(true);
    });

    it('should return false when access token is valid', () => {
      (service as any).accessToken = 'mock_token';
      (service as any).accessTokenExpiringTime = Date.now() + 1000;
      
      const result = (service as any).accessTokenNeedsRefreshing();
      
      expect(result).toBe(false);
    });
  });

  describe('getAccessTokenFromRefreshToken', () => {
    it('should successfully obtain access token', async () => {
      const mockResponse = {
        status: 200,
        data: {
          access_token: 'new_access_token',
          expires_in: 7200,
        },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await (service as any).getAccessTokenFromRefreshToken(
        'refresh_token',
        'client_id',
        'client_secret',
        '["scope"]'
      );

      expect(result).toBe(true);
      expect((service as any).accessToken).toBe('new_access_token');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.ebay.com/identity/v1/oauth2/token',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should return false when API call fails', async () => {
      const mockResponse = {
        status: 400,
        data: { error: 'invalid_request' },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await (service as any).getAccessTokenFromRefreshToken(
        'refresh_token',
        'client_id',
        'client_secret',
        '["scope"]'
      );

      expect(result).toBe(false);
    });

    it('should handle API errors', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      const result = await (service as any).getAccessTokenFromRefreshToken(
        'refresh_token',
        'client_id',
        'client_secret',
        '["scope"]'
      );

      expect(result).toBeUndefined();
    });
  });

  describe('prepareCustomerDetails', () => {
    it('should prepare customer details correctly', () => {
      const mockBuyerAddress: BuyerRegistrationAddress = {
        fullName: 'John Doe',
        contactAddress: {
          addressLine1: '123 Main St',
          addressLine2: 'Apt 4B',
          city: 'New York',
          stateOrProvince: 'NY',
          postalCode: '10001',
          countryCode: 'US',
        },
      };

      const result = (service as any).prepareCustomerDetails(mockBuyerAddress, 'johndoe');

      expect(result).toBeInstanceOf(Customer);
      expect(result.username).toBe('johndoe');
      expect(result.full_name).toBe('John Doe');
      expect(result.address_street).toBe('123 Main St Apt 4B');
      expect(result.city).toBe('New York');
      expect(result.postal_code).toBe('NY 10001');
      expect(result.country_code).toBe(CountryCode.US);
    });

    it('should handle US address format correctly', () => {
      const mockBuyerAddress: BuyerRegistrationAddress = {
        fullName: 'Jane Smith',
        contactAddress: {
          addressLine1: '456 Oak Ave',
          city: 'Los Angeles',
          stateOrProvince: 'CA',
          postalCode: '90210',
          countryCode: 'US',
        },
      };

      const result = (service as any).prepareCustomerDetails(mockBuyerAddress, 'janesmith');

      expect(result.postal_code).toBe('CA 90210');
      expect(result.city).toBe('Los Angeles');
    });

    it('should handle international address format correctly', () => {
      const mockBuyerAddress: BuyerRegistrationAddress = {
        fullName: 'Hans Mueller',
        contactAddress: {
          addressLine1: '789 Berliner Str',
          city: 'Berlin',
          stateOrProvince: 'Berlin',
          postalCode: '10115',
          countryCode: 'DE',
        },
      };

      const result = (service as any).prepareCustomerDetails(mockBuyerAddress, 'hansmueller');

      expect(result.postal_code).toBe('10115');
      expect(result.city).toBe('Berlin, Berlin');
    });

    it('should handle address without stateOrProvince', () => {
      const mockBuyerAddress: BuyerRegistrationAddress = {
        fullName: 'Pierre Dubois',
        contactAddress: {
          addressLine1: '321 Rue de la Paix',
          city: 'Paris',
          postalCode: '75001',
          countryCode: 'FR',
        },
      };

      const result = (service as any).prepareCustomerDetails(mockBuyerAddress, 'pierredubois');

      expect(result.postal_code).toBe('75001');
      expect(result.city).toBe('Paris');
    });
  });

  describe('prepareOrderItemsDetails', () => {
    it('should prepare order items correctly', () => {
      const mockLineItems: LineItem[] = [
        {
          lineItemId: 1,
          legacyItemId: '123456789',
          sku: 'TEST-SKU-001',
          title: 'Test Item 1',
          quantity: 2,
          lineItemCost: { value: 25.50, currency: 'USD' },
          soldFormat: 'AUCTION',
          listingMarketplaceId: 'EBAY_US',
          purchaseMarketplaceId: 'EBAY_US',
          lineItemFulfillmentStatus: 'FULFILLED',
        },
        {
          lineItemId: 2,
          legacyItemId: '987654321',
          sku: undefined,
          title: 'Test Item 2',
          quantity: 1,
          lineItemCost: { value: 15.00, currency: 'GBP' },
          soldFormat: 'FIXED_PRICE',
          listingMarketplaceId: 'EBAY_GB',
          purchaseMarketplaceId: 'EBAY_GB',
          lineItemFulfillmentStatus: 'PENDING',
        },
      ];

      const result = (service as any).prepareOrderItemsDetails(mockLineItems);

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(OrderItem);
      expect(result[0].platform_item_id).toBe('123456789');
      expect(result[0].sku).toBe('TEST-SKU-001');
      expect(result[0].quantity).toBe(2);
      expect(result[0].total_price).toBe(25.50);
      expect(result[0].platform).toBe(Platform.EBAY_US);

      expect(result[1].sku).toBeUndefined();
      expect(result[1].platform).toBe(Platform.EBAY_GB);
    });
  });

  describe('prepareOrderDetails', () => {
    it('should prepare order details correctly for USD', () => {
      const mockOrder = {
        orderId: 'TEST-ORDER-123',
        creationDate: '2025-01-01T10:00:00.000Z',
        orderPaymentStatus: 'PAID',
        paymentSummary: {
          payments: [{ paymentDate: '2025-01-01T10:05:00.000Z' }],
        },
        pricingSummary: {
          total: { value: '100.00', currency: 'USD' },
          deliveryCost: { value: '10.00' },
        },
      };

      const result = (service as any).prepareOrderDetails(mockOrder);

      expect(result).toBeInstanceOf(Order);
      expect(result.platform).toBe(CurrencyMarketplaceMap['USD']);
      expect(result.platform_order_id).toBe('TEST-ORDER-123');
      expect(result.paid).toBe(true);
      expect(result.total_price).toBe('100.00');
      expect(result.total_delivery).toBe('10.00');
      expect(result.currency).toBe('USD');
    });

    it('should prepare order details correctly for EUR', () => {
      const mockOrder = {
        orderId: 'TEST-ORDER-EUR',
        creationDate: '2025-01-01T10:00:00.000Z',
        orderPaymentStatus: 'PENDING',
        paymentSummary: {
          payments: [{ paymentDate: '2025-01-01T10:05:00.000Z' }],
        },
        pricingSummary: {
          total: { value: '85.50', currency: 'EUR' },
          deliveryCost: { value: '5.00' },
        },
      };

      const result = (service as any).prepareOrderDetails(mockOrder);

      expect(result.platform).toBe(CurrencyMarketplaceMap['EUR']);
      expect(result.paid).toBe(false);
      expect(result.currency).toBe('EUR');
    });

              it('should handle missing payment date', () => {
       const mockOrder = {
         orderId: 'TEST-ORDER-NO-PAYMENT',
         creationDate: '2025-01-01T10:00:00.000Z',
         orderPaymentStatus: 'PENDING',
         paymentSummary: {
           payments: [],
         },
         pricingSummary: {
           total: { value: '50.00', currency: 'GBP' },
           deliveryCost: { value: '0.00' },
         },
       };

       expect(() => (service as any).prepareOrderDetails(mockOrder)).toThrow();
     });
  });

  describe('processEbayOrders', () => {
    it('should mark existing order as paid when payment status changes', async () => {
      const mockOrder = {
        orderId: 'EXISTING-ORDER',
        orderPaymentStatus: 'PAID',
        paymentSummary: {
          payments: [{ paymentDate: '2025-01-01T10:05:00.000Z' }],
        },
        buyer: {
          buyerRegistrationAddress: { fullName: 'John Doe' },
        },
      };

      const mockExistingOrder = {
        id: 1,
        paid: false,
      };

      mockRepositoriesService.getOrderByPlatformOrderId.mockResolvedValue(mockExistingOrder);
      const setOrderAsPaidSpy = jest.spyOn(service as any, 'setOrderAsPaid').mockResolvedValue(undefined);

      await (service as any).processEbayOrders([mockOrder]);

      expect(setOrderAsPaidSpy).toHaveBeenCalledWith('EXISTING-ORDER', '2025-01-01T10:05:00.000Z');
    });

    it('should add new order to database', async () => {
      const mockOrder = {
        orderId: 'NEW-ORDER',
        orderPaymentStatus: 'PAID',
        buyer: {
          buyerRegistrationAddress: { fullName: 'Jane Smith' },
          username: 'janesmith',
        },
        lineItems: [],
        paymentSummary: {
          payments: [{ paymentDate: '2025-01-01T10:05:00.000Z' }],
        },
        pricingSummary: {
          total: { value: '100.00', currency: 'USD' },
          deliveryCost: { value: '10.00' },
        },
        creationDate: '2025-01-01T10:00:00.000Z',
      };

      mockRepositoriesService.getOrderByPlatformOrderId.mockResolvedValue(null);
      mockRepositoriesService.addCustomerToDatabase.mockResolvedValue(1);
      mockRepositoriesService.addOrderToDatabase.mockResolvedValue(1);
      mockRepositoriesService.addOrderItemsToDatabase.mockResolvedValue(undefined);

      const addOrderToDatabaseSpy = jest.spyOn(service as any, 'addOrderToDatabase').mockResolvedValue(undefined);

      await (service as any).processEbayOrders([mockOrder]);

      expect(addOrderToDatabaseSpy).toHaveBeenCalledWith(mockOrder);
    });

    it('should skip existing orders', async () => {
      const mockOrder = {
        orderId: 'EXISTING-ORDER',
        orderPaymentStatus: 'PAID',
        buyer: {
          buyerRegistrationAddress: { fullName: 'John Doe' },
        },
      };

      const mockExistingOrder = {
        id: 1,
        paid: true,
      };

      mockRepositoriesService.getOrderByPlatformOrderId.mockResolvedValue(mockExistingOrder);

      await (service as any).processEbayOrders([mockOrder]);

      expect(mockRepositoriesService.setOrderAsPaid).not.toHaveBeenCalled();
    });
  });

  describe('setOrderAsPaid', () => {
    it('should set order as paid with valid payment date', async () => {
      const paymentDate = '2025-01-01T10:05:00.000Z';
      
      await (service as any).setOrderAsPaid('TEST-ORDER', paymentDate);

      expect(mockRepositoriesService.setOrderAsPaid).toHaveBeenCalledWith('TEST-ORDER', expect.any(Date));
    });

    it('should handle invalid payment date', async () => {
      const invalidPaymentDate = 'invalid-date';
      
      await (service as any).setOrderAsPaid('TEST-ORDER', invalidPaymentDate);

      expect(mockRepositoriesService.setOrderAsPaid).toHaveBeenCalledWith('TEST-ORDER', expect.any(Date));
    });
  });

  describe('addOrderToDatabase', () => {
    it('should add complete order data to database', async () => {
      const mockOrder = {
        orderId: 'TEST-ORDER',
        buyer: {
          buyerRegistrationAddress: {
            fullName: 'John Doe',
            contactAddress: {
              addressLine1: '123 Main St',
              city: 'New York',
              stateOrProvince: 'NY',
              postalCode: '10001',
              countryCode: 'US',
            },
          },
          username: 'johndoe',
        },
        lineItems: [
          {
            legacyItemId: '123456789',
            sku: 'TEST-SKU',
            quantity: 1,
            lineItemCost: { value: '25.00' },
            listingMarketplaceId: 'EBAY_US',
          },
        ],
        paymentSummary: {
          payments: [{ paymentDate: '2025-01-01T10:05:00.000Z' }],
        },
        pricingSummary: {
          total: { value: '35.00', currency: 'USD' },
          deliveryCost: { value: '10.00' },
        },
        creationDate: '2025-01-01T10:00:00.000Z',
        orderPaymentStatus: 'PAID',
      };

      mockRepositoriesService.addCustomerToDatabase.mockResolvedValue(1);
      mockRepositoriesService.addOrderToDatabase.mockResolvedValue(1);
      mockRepositoriesService.addOrderItemsToDatabase.mockResolvedValue(undefined);

      await (service as any).addOrderToDatabase(mockOrder);

      expect(mockRepositoriesService.addCustomerToDatabase).toHaveBeenCalledWith(expect.any(Customer));
      expect(mockRepositoriesService.addOrderToDatabase).toHaveBeenCalledWith(expect.any(Order));
      expect(mockRepositoriesService.addOrderItemsToDatabase).toHaveBeenCalledWith(expect.arrayContaining([expect.any(OrderItem)]));
    });

         it('should handle incomplete data gracefully', async () => {
       const mockOrder = {
         orderId: 'INCOMPLETE-ORDER',
         buyer: {
           buyerRegistrationAddress: {
             fullName: 'Test User',
             contactAddress: {
               addressLine1: '123 Test St',
               city: 'Test City',
               postalCode: '12345',
               countryCode: 'US',
             },
           },
           username: 'testuser',
         },
         lineItems: [],
         paymentSummary: {
           payments: [{ paymentDate: '2025-01-01T10:05:00.000Z' }],
         },
         pricingSummary: {
           total: { value: '35.00', currency: 'USD' },
           deliveryCost: { value: '10.00' },
         },
         creationDate: '2025-01-01T10:00:00.000Z',
         orderPaymentStatus: 'PAID',
       };

       mockRepositoriesService.addCustomerToDatabase.mockResolvedValue(1);
       mockRepositoriesService.addOrderToDatabase.mockResolvedValue(1);
       mockRepositoriesService.addOrderItemsToDatabase.mockResolvedValue(undefined);

       await (service as any).addOrderToDatabase(mockOrder);

       expect(mockRepositoriesService.addCustomerToDatabase).toHaveBeenCalled();
       expect(mockRepositoriesService.addOrderToDatabase).toHaveBeenCalled();
       expect(mockRepositoriesService.addOrderItemsToDatabase).toHaveBeenCalled();
     });
  });
});
