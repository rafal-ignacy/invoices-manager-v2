# Invoices Manager v2

A comprehensive invoice management system built with NestJS that automatically syncs orders from multiple eBay marketplaces and generates invoices for customers.

## 🚀 Features

- **Multi-Marketplace Integration**: Automatically syncs orders from eBay US, UK, and German marketplaces
- **Real-time Order Processing**: Scheduled job runs every 5 minutes to fetch and process new orders
- **Customer Management**: Stores customer information with address details and country codes
- **Order Tracking**: Complete order lifecycle management with payment status tracking
- **Invoice Generation**: Automated invoice creation for completed orders
- **Database Persistence**: Robust data storage with PostgreSQL and TypeORM

## 🛠️ Tech Stack

### Backend Framework
- **NestJS** - Progressive Node.js framework for building scalable server-side applications
- **TypeScript** - Type-safe JavaScript for better development experience

### Database & ORM
- **PostgreSQL** - Reliable, open-source relational database
- **TypeORM** - Object-Relational Mapping library for TypeScript

### Authentication & APIs
- **eBay API** - Integration with eBay's Fulfillment API for order management
- **OAuth 2.0** - Secure token-based authentication with eBay

### Scheduling & Background Jobs
- **@nestjs/schedule** - Cron job scheduling for automated order fetching

### HTTP Client
- **Axios** - Promise-based HTTP client for API requests

### Development Tools
- **ESLint** - Code linting and formatting
- **pnpm** - Fast, disk space efficient package manager

## 📁 Project Structure

```
src/
├── entities/           # Database entities (Customer, Order, OrderItem)
├── ebay/              # eBay integration module
│   ├── ebay.service.ts        # Main eBay service with order processing
│   ├── ebay.interfaces.ts     # TypeScript interfaces for eBay data
│   ├── ebay.const.ts          # Constants and mappings
│   └── ebay.module.ts         # eBay module configuration
├── repositories/      # Data access layer
├── shared/           # Shared constants and utilities
├── migrations/       # Database migrations
└── main.ts          # Application entry point
```

## 🗄️ Database Schema

### Customers Table
- Customer information with full name, username, and address details
- Support for international addresses with country codes
- Flexible address formatting for different countries

### Orders Table
- Order details with platform identification (eBay US/UK/DE)
- Payment status tracking and dates
- Total pricing with delivery costs
- Currency support (USD, GBP, EUR)

### Order Items Table
- Individual items within orders
- SKU tracking and platform item IDs
- Quantity and pricing information

## 🔧 Environment Variables

Create a `.env` file with the following variables:

```env
# eBay API Configuration
EBAY_REFRESH_TOKEN=your_refresh_token
EBAY_CLIENT_ID=your_client_id
EBAY_CLIENT_SECRET=your_client_secret
EBAY_SCOPE=your_scope_json

# Database Configuration
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=your_username
DATABASE_PASSWORD=your_password
DATABASE_NAME=invoices_manager
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL database
- eBay Developer Account with API access

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd invoices-manager-v2
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run database migrations**
   ```bash
   pnpm run migration:run
   ```

5. **Start the application**
   ```bash
   # Development mode
   pnpm run start:dev
   
   # Production mode
   pnpm run start:prod
   ```

## 🔄 How It Works

### Order Processing Flow

1. **Scheduled Job**: Every 5 minutes, the system fetches orders from eBay API
2. **Order Filtering**: Only processes orders from the last 3 days
3. **Duplicate Check**: Skips orders that already exist in the database
4. **Data Transformation**: Converts eBay API data to internal database format
5. **Database Storage**: Saves customer, order, and order item data
6. **Payment Tracking**: Updates payment status for existing orders

### Data Mapping

The system automatically maps:
- **Currency to Platform**: USD → EBAY_US, GBP → EBAY_GB, EUR → EBAY_DE
- **Address Formatting**: Different formats for US vs international addresses
- **Customer Data**: Full name, address, and contact information

## 📊 API Endpoints

- `GET /` - Health check endpoint
- Additional endpoints can be added for invoice generation and reporting

## 🔍 Logging

The application provides comprehensive logging:
- Order processing status
- Customer and order creation confirmations
- SKU tracking for order items
- Error handling and debugging information

## 🧪 Testing

```bash
# Unit tests
pnpm run test

# E2E tests
pnpm run test:e2e

# Test coverage
pnpm run test:cov
```

## 📦 Docker Support

The project includes Docker configuration for easy deployment:

```bash
# Build and run with Docker Compose
docker-compose up -d
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions, please open an issue in the repository or contact the development team.