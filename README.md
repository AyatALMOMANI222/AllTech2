# AllTech Business Management System

A comprehensive Enterprise Resource Planning (ERP) system designed for managing business operations including purchase orders, sales invoices, inventory, customers, suppliers, and warranty tracking.

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Key Features & Functionalities](#key-features--functionalities)
- [Important Notes](#important-notes)

## 🎯 Project Overview

AllTech Business Management System is a full-stack web application that provides comprehensive business management capabilities. The system handles:

- **Purchase Order Management**: Create, edit, and track customer and supplier purchase orders with automatic status updates
- **Invoice Management**: Generate and manage sales and purchase tax invoices with VAT calculations
- **Inventory Management**: Track inventory levels, stock movements, and balance calculations
- **Customer/Supplier Management**: Maintain customer and supplier information with document storage
- **Database Dashboard**: Unified view of all purchase orders, deliveries, and inventory data
- **Warranty Management**: Track warranty information for inventory items
- **Document Management**: Upload, download, and manage documents for purchase orders and invoices
- **User Management**: Role-based access control with admin and user roles

## ✨ Features

### 1. Purchase Order Management
- **Dual Order Types**: Support for both Customer Purchase Orders and Supplier Purchase Orders
- **Linked Orders**: Create Supplier POs directly from Customer POs with automatic linking
- **Auto-Generated PO Numbers**: Format `PO-YYYY-XXX` (e.g., `PO-2025-001`)
- **Excel/CSV Import**: Bulk import purchase order items from Excel or CSV files
- **Status Management**: Automatic status updates (`approved`, `partially_delivered`, `delivered_completed`)
- **Due Date Calculation**: Automatic due date calculation based on PO date and lead time
- **Document Storage**: Upload and manage PDF documents for each purchase order
- **Penalty Tracking**: Calculate and track penalty amounts based on delivered quantities

### 2. Invoice Management
- **Sales Tax Invoices**: Generate invoices for customers with VAT calculations
- **Purchase Tax Invoices**: Generate invoices from suppliers
- **Automatic Calculations**:
  - Subtotal calculation
  - Claim amount calculation (percentage-based)
  - VAT calculation (5%)
  - Gross total calculation
- **Amount in Words**: Automatic conversion of amounts to words
- **PDF Export**: Download invoices as PDF files
- **Payment Tracking**: Record and track payment status for each invoice
- **Document Management**: Attach and manage documents for invoices

### 3. Inventory Management
- **Stock Tracking**: Track inventory quantities, unit prices, and total values
- **Automatic Calculations**:
  - Total price = quantity × supplier unit price
  - Balance = quantity - sold quantity
  - Balance amount = balance × supplier unit price
- **Inventory Reports**: Generate reports for specific dates with filtering and sorting
- **CSV Import**: Bulk import inventory items from CSV files
- **Real-time Updates**: Automatic inventory updates when invoices are created

### 4. Database Dashboard
- **Unified View**: Comprehensive view of all purchase orders, deliveries, and inventory
- **Multiple Sections**:
  - ALLTECH DATABASE: Core item information
  - SUPPLIER APPROVED PURCHASE ORDER: Supplier order details
  - SUPPLIER DELIVERED PURCHASE ORDER: Delivery tracking for suppliers
  - CUSTOMER APPROVED SALES ORDER: Customer order details
  - CUSTOMER DELIVERED SALES ORDER: Delivery tracking for customers
- **Automatic Calculations**: Real-time calculation of delivered quantities, prices, and penalties
- **Filtering & Search**: Search and filter by project number, part number, material number, etc.
- **Pagination**: Efficient handling of large datasets
- **Export**: Export dashboard data to Excel/CSV

### 5. Customer/Supplier Management
- **Unified Management**: Single interface for managing both customers and suppliers
- **Company Information**: Store company name, address, TRN number, contact details
- **Document Storage**: Attach and manage documents for each customer/supplier
- **Country Support**: Track country information for international operations

### 6. Warranty Management
- **Warranty Tracking**: Track warranty information for inventory items
- **Warranty Reports**: Generate reports showing items under warranty
- **Expiry Tracking**: Monitor warranty expiration dates

### 7. User Management
- **Role-Based Access**: Admin and User roles with different permissions
- **User CRUD Operations**: Create, read, update, and delete users
- **Password Management**: Secure password hashing and management

### 8. Document Management
- **Bunny Storage Integration**: Cloud storage using Bunny.net for document storage
- **Upload/Download**: Upload and download documents for purchase orders and invoices
- **Bulk Operations**: Download all documents as a ZIP file
- **Secure Access**: Authenticated document access to prevent unauthorized downloads

## 🛠 Technology Stack

### Frontend
- **React 18.2.0**: Modern UI library
- **React Router DOM 6.8.1**: Client-side routing
- **Bootstrap 5.2.3**: CSS framework for responsive design
- **Sass 1.58.3**: CSS preprocessor
- **Axios 1.3.4**: HTTP client for API requests
- **Font Awesome 7.1.0**: Icon library
- **React Scripts 5.0.1**: Build tools and scripts

### Backend
- **Node.js**: JavaScript runtime
- **Express 4.18.2**: Web application framework
- **MySQL2 3.6.5**: MySQL database driver
- **JWT (jsonwebtoken 9.0.2)**: Authentication tokens
- **Bcryptjs 2.4.3**: Password hashing
- **Multer 1.4.5-lts.1**: File upload handling
- **XLSX 0.18.5**: Excel file processing
- **Archiver 5.3.1**: ZIP file creation
- **Puppeteer 24.24.1**: PDF generation
- **Express Validator 7.0.1**: Input validation
- **CORS 2.8.5**: Cross-origin resource sharing
- **Dotenv 16.3.1**: Environment variable management

### Database
- **MySQL**: Relational database management system

### Storage
- **Bunny.net Storage**: Cloud storage for document management

## 📁 Project Structure

```
AllTech2/
├── backend/
│   ├── routes/              # API route handlers
│   │   ├── auth.js          # Authentication endpoints
│   │   ├── users.js         # User management
│   │   ├── customersSuppliers.js  # Customer/Supplier CRUD
│   │   ├── purchaseOrders.js     # Purchase order management
│   │   ├── salesTaxInvoices.js   # Sales invoice management
│   │   ├── purchaseTaxInvoices.js # Purchase invoice management
│   │   ├── inventory.js           # Inventory management
│   │   ├── inventoryReports.js    # Inventory reporting
│   │   ├── databaseDashboard.js   # Unified dashboard
│   │   ├── warranty.js            # Warranty management
│   │   └── storage.js             # File storage endpoints
│   ├── services/
│   │   └── bunnyStorage.js   # Bunny.net storage integration
│   ├── middleware/
│   │   └── auth.js          # Authentication middleware
│   ├── migrations/          # Database migration scripts
│   ├── utils/               # Utility functions
│   ├── initDb.js            # Database initialization
│   └── server.js            # Express server setup
│
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── Dashboard/
│   │   │   ├── DatabaseDashboard/
│   │   │   ├── PurchaseOrdersManagement/
│   │   │   ├── SalesTaxInvoice/
│   │   │   ├── PurchaseTaxInvoice/
│   │   │   ├── InvoicesManagement/
│   │   │   ├── InventoryManagement/
│   │   │   ├── InventoryReport/
│   │   │   ├── CustomerSupplierManagement/
│   │   │   ├── WarrantyManagement/
│   │   │   └── WarrantyReport/
│   │   ├── services/
│   │   │   └── api.js       # API service layer
│   │   ├── utils/
│   │   │   ├── AuthContext.js      # Authentication context
│   │   │   ├── formatCurrency.js   # Currency formatting
│   │   │   └── formatNumber.js     # Number formatting
│   │   └── styles/          # Global styles
│   └── public/              # Static files
│
└── README.md                # This file
```

## 🚀 Installation

### Prerequisites
- Node.js (v14 or higher)
- MySQL (v5.7 or higher)
- npm or yarn

### Step 1: Clone the Repository
```bash
git clone <repository-url>
cd AllTech2
```

### Step 2: Install Dependencies

#### Backend
```bash
cd backend
npm install
```

#### Frontend
```bash
cd frontend
npm install
```

### Step 3: Database Setup

1. Create a MySQL database:
```sql
CREATE DATABASE alltech_business;
```

2. Initialize the database schema:
```bash
cd backend
node initDb.js
```

Or use the npm script:
```bash
npm run init-db
```

### Step 4: Environment Configuration

Create a `.env` file in the `backend` directory:

```env
# Database Configuration
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=alltech_business

# Server Configuration
PORT=8000
NODE_ENV=development

# JWT Secret
JWT_SECRET=your_jwt_secret_key

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Bunny.net Storage Configuration
BUNNY_STORAGE_HOSTNAME=your_hostname.bunnycdn.com
BUNNY_STORAGE_USERNAME=your_storage_zone
BUNNY_STORAGE_PASSWORD=your_access_key
BUNNY_STORAGE_URL=https://your_cdn_url.b-cdn.net

# File Upload Limits
PO_DOCUMENT_MAX_FILE_SIZE=26214400  # 25MB in bytes
```

### Step 5: Run the Application

#### Start Backend Server
```bash
cd backend
npm start
```

The backend server will run on `http://localhost:8000`

#### Start Frontend Development Server
```bash
cd frontend
npm start
```

The frontend will run on `http://localhost:3000`

## ⚙️ Configuration

### Database Configuration
The system supports both local MySQL databases and Railway DATABASE_URL format:

**Local Development:**
```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=password
DB_DATABASE=alltech_business
```

**Railway/Production:**
```env
DATABASE_URL=mysql://user:password@host:port/database
```

### CORS Configuration
Configure allowed origins in `.env`:
```env
CORS_ORIGIN=http://localhost:3000,https://yourdomain.com
```

Or use `*` to allow all origins (not recommended for production).

### Bunny Storage Configuration
Set up Bunny.net storage for document management:
1. Create a storage zone in Bunny.net
2. Get the hostname, storage zone name, and access key
3. Configure CDN URL for public access
4. Add credentials to `.env` file

## 📖 Usage

### Initial Setup

1. **Create Admin User**: After starting the server, register the first user through the registration endpoint or directly in the database.

2. **Login**: Use the admin credentials to log in to the system.

3. **Configure Customers/Suppliers**: Add your customers and suppliers before creating purchase orders.

4. **Set Up Inventory**: Import or manually add inventory items.

### Creating a Purchase Order

1. Navigate to **Purchase Orders** from the dashboard
2. Click **Create New Purchase Order**
3. Select Customer/Supplier
4. Add items manually or import from Excel/CSV
5. Review and approve the order

### Creating an Invoice

1. Navigate to **Invoices** from the dashboard
2. Select **Sales Tax Invoice** or **Purchase Tax Invoice**
3. Fill in invoice details
4. Add items and quantities
5. System automatically calculates:
   - Subtotal
   - Claim amount
   - VAT (5%)
   - Gross total
6. Save and generate PDF

### Managing Inventory

1. Navigate to **Inventory Management**
2. Add items manually or import from CSV
3. System automatically calculates:
   - Total price
   - Balance
   - Balance amount
4. View inventory reports for specific dates

### Database Dashboard

1. Navigate to **Database Dashboard**
2. View unified data from all purchase orders
3. Filter by date, search terms, or specific criteria
4. Export data to Excel/CSV

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/:id` - Get user by ID
- `POST /api/auth/register` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `PUT /api/users/:id/password` - Change password

### Purchase Orders
- `GET /api/purchase-orders` - Get all purchase orders
- `GET /api/purchase-orders/:id` - Get purchase order by ID
- `POST /api/purchase-orders` - Create purchase order
- `PUT /api/purchase-orders/:id` - Update purchase order
- `DELETE /api/purchase-orders/:id` - Delete purchase order
- `POST /api/purchase-orders/:id/create-supplier-po` - Create supplier PO from customer PO
- `GET /api/purchase-orders/:id/documents` - Get PO documents
- `POST /api/purchase-orders/:id/documents` - Upload PO documents
- `GET /api/purchase-orders/documents/:id/download` - Download document
- `POST /api/purchase-orders/:id/documents/export` - Export all documents
- `DELETE /api/purchase-orders/documents/:id` - Delete document

### Sales Tax Invoices
- `GET /api/sales-tax-invoices` - Get all sales invoices
- `GET /api/sales-tax-invoices/:id` - Get invoice by ID
- `POST /api/sales-tax-invoices` - Create sales invoice
- `PUT /api/sales-tax-invoices/:id` - Update invoice
- `DELETE /api/sales-tax-invoices/:id` - Delete invoice
- `GET /api/sales-tax-invoices/:id/documents` - Get invoice documents
- `POST /api/sales-tax-invoices/:id/documents` - Upload document
- `GET /api/sales-tax-invoices/documents/:id/download` - Download document
- `DELETE /api/sales-tax-invoices/documents/:id` - Delete document

### Purchase Tax Invoices
- `GET /api/purchase-tax-invoices` - Get all purchase invoices
- `GET /api/purchase-tax-invoices/:id` - Get invoice by ID
- `POST /api/purchase-tax-invoices` - Create purchase invoice
- `PUT /api/purchase-tax-invoices/:id` - Update invoice
- `DELETE /api/purchase-tax-invoices/:id` - Delete invoice
- `GET /api/purchase-tax-invoices/:id/documents` - Get invoice documents
- `POST /api/purchase-tax-invoices/:id/documents` - Upload document
- `GET /api/purchase-tax-invoices/documents/:id/download` - Download document
- `DELETE /api/purchase-tax-invoices/documents/:id` - Delete document

### Inventory
- `GET /api/inventory` - Get all inventory items
- `GET /api/inventory/:id` - Get inventory item by ID
- `POST /api/inventory` - Create inventory item
- `PUT /api/inventory/:id` - Update inventory item
- `DELETE /api/inventory/:id` - Delete inventory item
- `POST /api/inventory/import` - Import inventory from CSV

### Database Dashboard
- `GET /api/database-dashboard` - Get dashboard data
- `POST /api/database-dashboard/export` - Export dashboard data

### Customers/Suppliers
- `GET /api/customers-suppliers` - Get all customers/suppliers
- `GET /api/customers-suppliers/:id` - Get by ID
- `POST /api/customers-suppliers` - Create customer/supplier
- `PUT /api/customers-suppliers/:id` - Update
- `DELETE /api/customers-suppliers/:id` - Delete

### Warranty
- `GET /api/warranty` - Get warranty records
- `POST /api/warranty` - Create warranty record
- `PUT /api/warranty/:id` - Update warranty
- `DELETE /api/warranty/:id` - Delete warranty

## 🗄️ Database Schema

### Core Tables

#### users
- `id` (INT, PRIMARY KEY)
- `username` (VARCHAR, UNIQUE)
- `email` (VARCHAR, UNIQUE)
- `password` (VARCHAR, hashed)
- `role` (ENUM: 'admin', 'user')
- `created_at`, `updated_at` (TIMESTAMP)

#### customers_suppliers
- `id` (VARCHAR, PRIMARY KEY)
- `type` (ENUM: 'customer', 'supplier')
- `company_name` (VARCHAR)
- `address` (TEXT)
- `trn_number` (VARCHAR)
- `contact_person` (VARCHAR)
- `email` (VARCHAR)
- `phone` (VARCHAR)
- `country` (VARCHAR)
- `created_at`, `updated_at` (TIMESTAMP)

#### purchase_orders
- `id` (INT, PRIMARY KEY)
- `po_number` (VARCHAR, format: PO-YYYY-XXX)
- `order_type` (ENUM: 'customer', 'supplier')
- `customer_supplier_id` (VARCHAR, FOREIGN KEY)
- `status` (ENUM: 'approved', 'partially_delivered', 'delivered_completed')
- `linked_customer_po_id` (INT, FOREIGN KEY, nullable)
- `created_by`, `approved_by` (INT, FOREIGN KEY to users)
- `created_at`, `updated_at` (TIMESTAMP)

#### purchase_order_items
- `id` (INT, PRIMARY KEY)
- `po_id` (INT, FOREIGN KEY)
- `serial_no`, `project_no`, `date_po` (VARCHAR/DATE)
- `part_no`, `material_no` (VARCHAR)
- `description`, `uom` (VARCHAR)
- `quantity`, `unit_price`, `total_price` (DECIMAL)
- `delivered_quantity`, `delivered_unit_price`, `delivered_total_price` (DECIMAL)
- `penalty_percentage`, `penalty_amount` (DECIMAL)
- `balance_quantity_undelivered` (DECIMAL)
- `invoice_no` (VARCHAR, comma-separated)
- `lead_time`, `due_date` (VARCHAR/DATE)
- `comments` (TEXT)
- `created_at`, `updated_at` (TIMESTAMP)

#### sales_tax_invoices
- `id` (INT, PRIMARY KEY)
- `invoice_number` (VARCHAR, UNIQUE)
- `invoice_date` (DATE)
- `customer_id` (VARCHAR, FOREIGN KEY)
- `customer_po_number` (VARCHAR)
- `subtotal`, `vat_amount`, `gross_total` (DECIMAL)
- `claim_percentage` (DECIMAL)
- `amount_paid` (DECIMAL)
- `payment_terms`, `contract_number`, `delivery_terms` (VARCHAR)
- `created_at`, `updated_at` (TIMESTAMP)

#### sales_tax_invoice_items
- `id` (INT, PRIMARY KEY)
- `invoice_id` (INT, FOREIGN KEY)
- `serial_no`, `project_no` (VARCHAR)
- `part_no`, `material_no` (VARCHAR)
- `description`, `uom` (VARCHAR)
- `quantity`, `unit_price`, `total_amount` (DECIMAL)
- `created_at`, `updated_at` (TIMESTAMP)

#### purchase_tax_invoices
- `id` (INT, PRIMARY KEY)
- `invoice_number` (VARCHAR, UNIQUE)
- `invoice_date` (DATE)
- `supplier_id` (VARCHAR, FOREIGN KEY)
- `po_number` (VARCHAR)
- `project_number` (VARCHAR)
- `subtotal`, `vat_amount`, `gross_total` (DECIMAL)
- `claim_percentage` (DECIMAL)
- `amount_paid` (DECIMAL)
- `created_at`, `updated_at` (TIMESTAMP)

#### purchase_tax_invoice_items
- `id` (INT, PRIMARY KEY)
- `invoice_id` (INT, FOREIGN KEY)
- `serial_no`, `project_no` (VARCHAR)
- `part_no`, `material_no` (VARCHAR)
- `description`, `uom` (VARCHAR)
- `quantity`, `supplier_unit_price`, `total_price` (DECIMAL)
- `created_at`, `updated_at` (TIMESTAMP)

#### inventory
- `id` (INT, PRIMARY KEY)
- `serial_no`, `project_no`, `date_po` (VARCHAR/DATE)
- `part_no`, `material_no` (VARCHAR)
- `description`, `uom` (VARCHAR)
- `quantity`, `supplier_unit_price`, `total_price` (DECIMAL)
- `sold_quantity`, `balance`, `balance_amount` (DECIMAL)
- `manufacturer_part_no` (VARCHAR)
- `created_at`, `updated_at` (TIMESTAMP)

#### warranty
- `id` (INT, PRIMARY KEY)
- `inventory_id` (INT, FOREIGN KEY)
- `warranty_start_date` (DATE)
- `warranty_end_date` (DATE)
- `warranty_provider` (VARCHAR)
- `warranty_terms` (TEXT)
- `created_at`, `updated_at` (TIMESTAMP)

#### po_documents
- `id` (INT, PRIMARY KEY)
- `po_id` (INT, FOREIGN KEY)
- `document_name` (VARCHAR)
- `document_type` (VARCHAR)
- `storage_path` (VARCHAR)
- `storage_url` (VARCHAR)
- `uploaded_by` (INT, FOREIGN KEY)
- `created_at` (TIMESTAMP)

#### invoice_documents
- `id` (INT, PRIMARY KEY)
- `invoice_id` (INT)
- `invoice_type` (ENUM: 'sales', 'purchase')
- `document_name` (VARCHAR)
- `document_type` (VARCHAR)
- `storage_path` (VARCHAR)
- `storage_url` (VARCHAR)
- `uploaded_by` (INT, FOREIGN KEY)
- `created_at` (TIMESTAMP)

## 🔑 Key Features & Functionalities

### Automatic Calculations

#### Purchase Order Status Updates
The system automatically updates purchase order status based on delivery:
- **approved**: No items delivered
- **partially_delivered**: Some items delivered
- **delivered_completed**: All items fully delivered

#### Delivered Data Calculation
When invoices are created, updated, or deleted, the system automatically:
1. Calculates delivered quantities by summing invoice quantities per item
2. Updates delivered unit price from invoice data
3. Calculates delivered total price = delivered quantity × delivered unit price
4. Calculates penalty amount = (penalty percentage × delivered total price) / 100
5. Calculates balance quantity undelivered = ordered quantity - delivered quantity
6. Updates invoice numbers (comma-separated list)
7. Updates PO status based on delivery progress

#### Invoice Calculations
- **Subtotal**: Sum of all item totals
- **Claim Amount**: Subtotal × (claim percentage / 100)
- **VAT Amount**: Claim amount × 0.05 (5%)
- **Gross Total**: Claim amount + VAT amount

#### Inventory Calculations
- **Total Price**: Quantity × Supplier Unit Price
- **Balance**: Quantity - Sold Quantity
- **Balance Amount**: Balance × Supplier Unit Price

### Automatic Triggers

The system uses database triggers and application-level functions to automatically:
- Recalculate delivered data when invoices are created/updated/deleted
- Update purchase order status based on delivery progress
- Update inventory when invoices are created
- Calculate penalty amounts when penalty percentage is updated

### PO Number Generation

Purchase order numbers are automatically generated in the format:
- `PO-YYYY-XXX` (e.g., `PO-2025-001`)
- Year-based sequential numbering
- Prevents duplicate numbers within the same year

### Due Date Calculation

Due dates are automatically calculated based on:
- PO date (date_po)
- Lead time (in days or weeks)
- Formula: PO Date + Lead Time = Due Date

### Document Management

- **Upload**: Upload PDF documents for purchase orders and invoices
- **Download**: Download individual documents or all documents as ZIP
- **Storage**: Documents stored in Bunny.net cloud storage
- **Security**: Authenticated access to prevent unauthorized downloads

### Excel/CSV Import

- **Purchase Orders**: Import items from Excel/CSV files
- **Inventory**: Import inventory items from CSV files
- **Date Conversion**: Automatic conversion of Excel date serial numbers
- **Validation**: Data validation and error handling

### Number Formatting

All monetary amounts are formatted with:
- Commas as thousand separators
- Two decimal places
- Consistent formatting across the entire system

## ⚠️ Important Notes

### Database Constraints
- `po_number` in `purchase_orders` does NOT have a UNIQUE constraint (allows duplicate PO numbers for different order types)
- Queries must filter by both `po_number` AND `order_type` to avoid "Result consisted of more than one row" errors
- `invoice_number` in invoices tables has UNIQUE constraints

### Order Types
- **Customer Purchase Orders** (`order_type = 'customer'`): Linked to Sales Tax Invoices
- **Supplier Purchase Orders** (`order_type = 'supplier'`): Linked to Purchase Tax Invoices
- Supplier POs can be linked to Customer POs via `linked_customer_po_id`

### Status Management
- Purchase order status is automatically updated based on delivery progress
- Status changes trigger recalculation of delivered data
- Status cannot be manually set; it's calculated automatically

### Invoice Linking
- Sales Tax Invoices link to Customer POs via `customer_po_number`
- Purchase Tax Invoices link to Supplier POs via `po_number`
- Multiple invoices can link to the same PO
- Delivered quantities are summed across all related invoices

### Penalty Calculation
- Penalty amount is calculated as: `delivered_total_price × (penalty_percentage / 100)`
- Penalty percentage can be set per item
- Penalty amount is automatically recalculated when:
  - Penalty percentage is updated
  - Delivered total price changes
  - Invoice is created/updated/deleted

### Inventory Updates
- Inventory is automatically updated when invoices are created
- Sold quantity increases when sales invoices are created
- Balance and balance amount are automatically recalculated

### Authentication
- JWT tokens are used for authentication
- Tokens are stored in localStorage
- Protected routes require valid authentication
- Admin routes require admin role

### File Storage
- Documents are stored in Bunny.net cloud storage
- Storage paths and URLs are stored in the database
- Direct access to storage URLs requires authentication
- Use API endpoints for secure document access

### Error Handling
- All API endpoints include error handling
- Database errors are logged and returned with appropriate status codes
- Frontend displays user-friendly error messages
- Validation errors are returned with detailed information

### Performance Considerations
- Database queries use indexes on frequently searched columns
- Pagination is implemented for large datasets
- Dashboard queries use GROUP BY and aggregation for efficiency
- File uploads are limited by size (configurable)

## 📝 License

ISC

## 👥 Author

AllTech Business Management System

---

**Note**: This README documents the current state of the project. For specific implementation details, refer to the code comments and inline documentation.
