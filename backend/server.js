const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Parse Railway DATABASE_URL if provided
function parseDatabaseUrl(url) {
  if (!url) return null;
  const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) return null;
  return {
    host: match[3],
    port: parseInt(match[4]),
    user: match[1],
    password: match[2],
    database: match[5]
  };
}

// CORS configuration - support multiple origins
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:3000'];

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection - support Railway DATABASE_URL or individual variables
const dbConfig = process.env.DATABASE_URL
  ? {
      ...parseDatabaseUrl(process.env.DATABASE_URL),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    }
  : {
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USERNAME || process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_DATABASE || process.env.DB_NAME || 'alltech_business',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };

const pool = mysql.createPool(dbConfig);

// Log database connection info (without password)
console.log('Database configuration:', {
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  database: dbConfig.database
});

// Make database pool available to routes
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// Auto-migration: Ensure inventory table has new columns
async function ensureInventoryColumns() {
  try {
    const connection = await pool.getConnection();
    
    // Check if inventory table exists
    const [tables] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'inventory'
    `);
    
    if (tables[0].count === 0) {
      console.log('Note: inventory table does not exist yet. It will be created with new columns when /api/initialize-database is called.');
      connection.release();
      return;
    }
    
    // Add manufacturer_part_number column if it doesn't exist
    try {
      await connection.execute(`
        ALTER TABLE inventory 
        ADD COLUMN manufacturer_part_number VARCHAR(100) AFTER balance_amount
      `);
      console.log('✓ manufacturer_part_number column added to inventory table');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column name')) {
        console.log('✓ manufacturer_part_number column already exists');
      } else {
        console.log('Note: manufacturer_part_number check:', error.message);
      }
    }
    
    // Add cost_price column if it doesn't exist
    try {
      await connection.execute(`
        ALTER TABLE inventory 
        ADD COLUMN cost_price DECIMAL(10,2) DEFAULT 0.0 AFTER manufacturer_part_number
      `);
      console.log('✓ cost_price column added to inventory table');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column name')) {
        console.log('✓ cost_price column already exists');
      } else {
        console.log('Note: cost_price check:', error.message);
      }
    }
    
    connection.release();
  } catch (error) {
    console.error('Error checking inventory columns:', error.message);
  }
}

// Auto-migration: Ensure customers_suppliers table has country column
async function ensureCustomersSuppliersColumns() {
  try {
    const connection = await pool.getConnection();
    
    // Check if customers_suppliers table exists
    const [tables] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'customers_suppliers'
    `);
    
    if (tables[0].count === 0) {
      console.log('Note: customers_suppliers table does not exist yet. It will be created with new columns when /api/initialize-database is called.');
      connection.release();
      return;
    }
    
    // Add country column if it doesn't exist
    try {
      await connection.execute(`
        ALTER TABLE customers_suppliers 
        ADD COLUMN country VARCHAR(100) AFTER document_attachment
      `);
      console.log('✓ country column added to customers_suppliers table');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column name')) {
        console.log('✓ country column already exists in customers_suppliers table');
      } else {
        console.log('Note: country column check:', error.message);
      }
    }
    
    connection.release();
  } catch (error) {
    console.error('Error checking customers_suppliers columns:', error.message);
  }
}

// Auto-migration: Ensure purchase_orders table has linked_customer_po_id column
async function ensurePurchaseOrdersColumns() {
  try {
    const connection = await pool.getConnection();
    
    // Check if purchase_orders table exists
    const [tables] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'purchase_orders'
    `);
    
    if (tables[0].count === 0) {
      console.log('Note: purchase_orders table does not exist yet. It will be created with new columns when /api/initialize-database is called.');
      connection.release();
      return;
    }
    
    // Add linked_customer_po_id column if it doesn't exist
    try {
      await connection.execute(`
        ALTER TABLE purchase_orders 
        ADD COLUMN linked_customer_po_id INT AFTER total_amount
      `);
      console.log('✓ linked_customer_po_id column added to purchase_orders table');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column name')) {
        console.log('✓ linked_customer_po_id column already exists in purchase_orders table');
      } else {
        console.log('Note: linked_customer_po_id column check:', error.message);
      }
    }
    
    // Add foreign key constraint if it doesn't exist
    try {
      await connection.execute(`
        ALTER TABLE purchase_orders 
        ADD CONSTRAINT fk_linked_customer_po 
        FOREIGN KEY (linked_customer_po_id) REFERENCES purchase_orders(id) ON DELETE SET NULL
      `);
      console.log('✓ Foreign key constraint for linked_customer_po_id added to purchase_orders table');
    } catch (error) {
      if (error.code === 'ER_DUP_KEY' || error.message.includes('Duplicate key name') || error.message.includes('already exists')) {
        console.log('✓ Foreign key constraint for linked_customer_po_id already exists in purchase_orders table');
      } else {
        console.log('Note: Foreign key constraint check:', error.message);
      }
    }
    
    connection.release();
  } catch (error) {
    console.error('Error checking purchase_orders columns:', error.message);
  }
}

// Auto-migration: Ensure invoice tables have amount_paid column
async function ensureInvoiceColumns() {
  try {
    const connection = await pool.getConnection();
    
    // Check if sales_tax_invoices table exists
    const [salesTables] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'sales_tax_invoices'
    `);
    
    if (salesTables[0].count > 0) {
      // Add amount_paid column to sales_tax_invoices if it doesn't exist
      try {
        await connection.execute(`
          ALTER TABLE sales_tax_invoices 
          ADD COLUMN amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER gross_total
        `);
        console.log('✓ amount_paid column added to sales_tax_invoices table');
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column name')) {
          console.log('✓ amount_paid column already exists in sales_tax_invoices table');
        } else {
          console.log('Note: amount_paid column check for sales_tax_invoices:', error.message);
        }
      }
    }
    
    // Check if purchase_tax_invoices table exists
    const [purchaseTables] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'purchase_tax_invoices'
    `);
    
    if (purchaseTables[0].count > 0) {
      // Add amount_paid column to purchase_tax_invoices if it doesn't exist
      try {
        await connection.execute(`
          ALTER TABLE purchase_tax_invoices 
          ADD COLUMN amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER gross_total
        `);
        console.log('✓ amount_paid column added to purchase_tax_invoices table');
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column name')) {
          console.log('✓ amount_paid column already exists in purchase_tax_invoices table');
        } else {
          console.log('Note: amount_paid column check for purchase_tax_invoices:', error.message);
        }
      }
    }
    
    connection.release();
  } catch (error) {
    console.error('Error checking invoice columns:', error.message);
  }
}

// Auto-migration: Ensure warranty_management table exists
async function ensureWarrantyTable() {
  try {
    const connection = await pool.getConnection();
    
    // Check if warranty_management table exists
    const [tables] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'warranty_management'
    `);
    
    if (tables[0].count === 0) {
      console.log('Creating warranty_management table...');
      // Create warranty_management table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS warranty_management (
          id INT AUTO_INCREMENT PRIMARY KEY,
          sr_no VARCHAR(100),
          part_no VARCHAR(100),
          material_no VARCHAR(100),
          description TEXT,
          project_no VARCHAR(100),
          part_cost DECIMAL(10,2) DEFAULT 0.00,
          serial_number VARCHAR(100),
          warranty_start_date DATE,
          warranty_end_date DATE,
          remarks TEXT,
          warranty_type ENUM('sales', 'purchase') NOT NULL DEFAULT 'sales',
          linked_po_id INT,
          linked_invoice_id INT,
          linked_invoice_type ENUM('sales', 'purchase'),
          created_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (linked_po_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `);
      console.log('✓ warranty_management table created');
    } else {
      console.log('✓ warranty_management table already exists');
    }
    
    connection.release();
  } catch (error) {
    console.error('Error checking/creating warranty_management table:', error.message);
    // Try to create table without foreign keys if they fail
    try {
      const connection = await pool.getConnection();
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS warranty_management (
          id INT AUTO_INCREMENT PRIMARY KEY,
          sr_no VARCHAR(100),
          part_no VARCHAR(100),
          material_no VARCHAR(100),
          description TEXT,
          project_no VARCHAR(100),
          part_cost DECIMAL(10,2) DEFAULT 0.00,
          serial_number VARCHAR(100),
          warranty_start_date DATE,
          warranty_end_date DATE,
          remarks TEXT,
          warranty_type ENUM('sales', 'purchase') NOT NULL DEFAULT 'sales',
          linked_po_id INT,
          linked_invoice_id INT,
          linked_invoice_type ENUM('sales', 'purchase'),
          created_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log('✓ warranty_management table created (without foreign keys)');
      connection.release();
    } catch (fallbackError) {
      console.error('Error creating warranty_management table (fallback):', fallbackError.message);
    }
  }
}

// Auto-migration: Ensure customer_supplier_documents table exists
async function ensureCustomerSupplierDocumentsTable() {
  try {
    const connection = await pool.getConnection();

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS customer_supplier_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_supplier_id VARCHAR(50) NOT NULL,
        file_name VARCHAR(255),
        file_type VARCHAR(100),
        document_type VARCHAR(100) DEFAULT 'Other',
        storage_path VARCHAR(500) NOT NULL,
        storage_url VARCHAR(500) NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_supplier_id) REFERENCES customers_suppliers(id) ON DELETE CASCADE
      )
    `);

    try {
      await connection.execute(`
        ALTER TABLE customer_supplier_documents
        CHANGE COLUMN file_path storage_path VARCHAR(500) NOT NULL
      `);
      console.log('✓ Renamed file_path column to storage_path');
    } catch (error) {
      if (
        error.code === 'ER_BAD_FIELD_ERROR' ||
        error.message.includes('Unknown column') ||
        error.message.includes("doesn't exist")
      ) {
        // file_path column not present, nothing to rename
      } else if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column name')) {
        try {
          await connection.execute(`
            UPDATE customer_supplier_documents
            SET storage_path = COALESCE(storage_path, file_path)
            WHERE file_path IS NOT NULL
          `);
          await connection.execute(`
            ALTER TABLE customer_supplier_documents
            DROP COLUMN file_path
          `);
          console.log('✓ Migrated file_path values and removed legacy column');
        } catch (migrationError) {
          console.log('Note: file_path migration check:', migrationError.message);
        }
      } else {
        console.log('Note: file_path rename check:', error.message);
      }
    }

    try {
      await connection.execute(`
        ALTER TABLE customer_supplier_documents
        ADD COLUMN document_type VARCHAR(100) DEFAULT 'Other' AFTER file_type
      `);
      console.log('✓ document_type column added to customer_supplier_documents table');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column name')) {
        // column already exists
      } else {
        console.log('Note: document_type column check:', error.message);
      }
    }

    try {
      await connection.execute(`
        ALTER TABLE customer_supplier_documents
        CHANGE COLUMN document_name file_name VARCHAR(255)
      `);
      console.log('✓ Renamed document_name column to file_name');
    } catch (error) {
      if (
        error.code === 'ER_BAD_FIELD_ERROR' ||
        error.message.includes('Unknown column') ||
        error.message.includes("doesn't exist")
      ) {
        // document_name column not present, nothing to rename
      } else if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column name')) {
        try {
          await connection.execute(`
            UPDATE customer_supplier_documents
            SET file_name = COALESCE(file_name, document_name)
            WHERE document_name IS NOT NULL
          `);
          await connection.execute(`
            ALTER TABLE customer_supplier_documents
            DROP COLUMN document_name
          `);
          console.log('✓ Migrated document_name values and removed legacy column');
        } catch (migrationError) {
          console.log('Note: document_name migration check:', migrationError.message);
        }
      } else {
        console.log('Note: document_name rename check:', error.message);
      }
    }

    connection.release();
    console.log('✓ customer_supplier_documents table ensured');
  } catch (error) {
    console.error('Error ensuring customer_supplier_documents table:', error.message);
  }
}

// Auto-migration: Ensure po_documents table has Bunny storage columns
async function ensurePODocumentsTable() {
  let connection;
  try {
    connection = await pool.getConnection();

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS po_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        po_id INT NOT NULL,
        document_name VARCHAR(255) NOT NULL,
        document_type ENUM('pdf', 'excel', 'image', 'other') DEFAULT 'pdf',
        storage_path VARCHAR(500) NOT NULL,
        storage_url VARCHAR(500) NOT NULL,
        uploaded_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    const [documentPathColumns] = await connection.execute(
      `SHOW COLUMNS FROM po_documents LIKE 'document_path'`
    );

    if (documentPathColumns.length > 0) {
      try {
        await connection.execute(`
          ALTER TABLE po_documents
          CHANGE COLUMN document_path storage_path VARCHAR(500) NOT NULL
        `);
        console.log('✓ Renamed document_path column to storage_path');
      } catch (error) {
        if (
          error.code === 'ER_BAD_FIELD_ERROR' ||
          error.message.includes('Unknown column') ||
          error.message.includes("doesn't exist")
        ) {
          // document_path column not present, nothing to rename
        } else if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column name')) {
          try {
            await connection.execute(`
              UPDATE po_documents
              SET storage_path = COALESCE(storage_path, document_path)
              WHERE document_path IS NOT NULL
            `);
            await connection.execute(`
              ALTER TABLE po_documents
              DROP COLUMN document_path
            `);
            console.log('✓ Migrated document_path values and removed legacy column');
          } catch (migrationError) {
            console.log('Note: document_path migration check:', migrationError.message);
          }
        } else {
          console.log('Note: document_path rename check:', error.message);
        }
      }
    }

    const [storagePathColumns] = await connection.execute(
      `SHOW COLUMNS FROM po_documents LIKE 'storage_path'`
    );
    if (storagePathColumns.length === 0) {
      await connection.execute(`
        ALTER TABLE po_documents
        ADD COLUMN storage_path VARCHAR(500) NOT NULL AFTER document_name
      `);
      console.log('✓ storage_path column added to po_documents table');
    }

    const [storageUrlColumns] = await connection.execute(
      `SHOW COLUMNS FROM po_documents LIKE 'storage_url'`
    );
    if (storageUrlColumns.length === 0) {
      await connection.execute(`
        ALTER TABLE po_documents
        ADD COLUMN storage_url VARCHAR(500) NOT NULL AFTER storage_path
      `);
      console.log('✓ storage_url column added to po_documents table');
    }

    try {
      await connection.execute(`
        ALTER TABLE po_documents
        MODIFY COLUMN document_type ENUM('pdf', 'excel', 'image', 'other') DEFAULT 'pdf'
      `);
    } catch (error) {
      console.log('Note: document_type column update:', error.message);
    }

    try {
      await connection.execute(`
        UPDATE po_documents
        SET storage_path = document_path
        WHERE storage_path IS NULL AND document_path IS NOT NULL
      `);
    } catch (error) {
      if (
        !(error.code === 'ER_BAD_FIELD_ERROR' || error.message.includes('Unknown column'))
      ) {
        console.log('Note: storage_path backfill:', error.message);
      }
    }

    try {
      await connection.execute(`
        UPDATE po_documents
        SET storage_url = storage_path
        WHERE storage_url IS NULL OR storage_url = ''
      `);
    } catch (error) {
      console.log('Note: storage_url backfill:', error.message);
    }

    console.log('✓ po_documents table ensured');
  } catch (error) {
    console.error('Error ensuring po_documents table:', error.message);
  } finally {
    if (connection) connection.release();
  }
}

// Run migrations on server startup
ensureInventoryColumns();
ensureCustomersSuppliersColumns();
ensurePurchaseOrdersColumns();
ensureInvoiceColumns();
ensureWarrantyTable();
ensureCustomerSupplierDocumentsTable();
ensurePODocumentsTable();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/customers-suppliers', require('./routes/customersSuppliers'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/inventory-reports', require('./routes/inventoryReports'));
app.use('/api/database-dashboard', require('./routes/databaseDashboard'));
app.use('/api/purchase-orders', require('./routes/purchaseOrders'));
app.use('/api/sales-tax-invoices', require('./routes/salesTaxInvoices'));
app.use('/api/purchase-tax-invoices', require('./routes/purchaseTaxInvoices'));
app.use('/api/warranty', require('./routes/warranty'));
app.use('/api/storage', require('./routes/storage'));
app.use('/api/customer-supplier-documents', require('./routes/customerSupplierDocuments'));

// Health check endpoint with database connectivity test
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      message: 'Server is running!',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: 'Server is running but database connection failed',
      error: error.message
    });
  }
});

// Temporary one-time database initialization endpoint
// REMOVE THIS AFTER RUNNING ONCE
app.get('/api/initialize-database', async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const connection = await mysql.createConnection(dbConfig);

    // Create users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'user') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create customers_suppliers table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS customers_suppliers (
        id VARCHAR(50) PRIMARY KEY,
        type ENUM('customer', 'supplier') NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        address TEXT,
        trn_number VARCHAR(50),
        contact_person VARCHAR(255),
        email VARCHAR(100),
        phone VARCHAR(20),
        document_attachment VARCHAR(500),
        country VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Add country column if it doesn't exist (for existing databases)
    try {
      await connection.execute(`
        ALTER TABLE customers_suppliers 
        ADD COLUMN country VARCHAR(100) AFTER document_attachment
      `);
      console.log('✓ country column added to customers_suppliers table');
    } catch (error) {
      // Column might already exist, ignore duplicate column error
      if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column name')) {
        console.log('✓ country column already exists');
      } else {
        console.log('Note: country column check:', error.message);
      }
    }

    // Create customer_supplier_documents table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS customer_supplier_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_supplier_id VARCHAR(50) NOT NULL,
        file_name VARCHAR(255),
        file_type VARCHAR(100),
        document_type VARCHAR(100) DEFAULT 'Other',
        storage_path VARCHAR(500) NOT NULL,
        storage_url VARCHAR(500) NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_supplier_id) REFERENCES customers_suppliers(id) ON DELETE CASCADE
      )
    `);

    // Create inventory table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS inventory (
        id INT AUTO_INCREMENT PRIMARY KEY,
        serial_no VARCHAR(100),
        project_no VARCHAR(100),
        date_po DATE,
        part_no VARCHAR(100),
        material_no VARCHAR(100),
        description TEXT,
        uom VARCHAR(50),
        quantity DECIMAL(10,2) DEFAULT 0,
        supplier_unit_price DECIMAL(10,2) DEFAULT 0.0,
        total_price DECIMAL(10,2) DEFAULT 0.0,
        sold_quantity DECIMAL(10,2) DEFAULT 0,
        balance DECIMAL(10,2) DEFAULT 0,
        balance_amount DECIMAL(10,2) DEFAULT 0.0,
        manufacturer_part_number VARCHAR(100),
        cost_price DECIMAL(10,2) DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Add new columns if they don't exist (for existing databases)
    try {
      await connection.execute(`
        ALTER TABLE inventory 
        ADD COLUMN manufacturer_part_number VARCHAR(100) AFTER balance_amount
      `);
      console.log('✓ manufacturer_part_number column added');
    } catch (error) {
      // Column might already exist, ignore duplicate column error
      if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column name')) {
        console.log('✓ manufacturer_part_number column already exists');
      } else {
        console.log('Note: manufacturer_part_number column check:', error.message);
      }
    }
    
    try {
      await connection.execute(`
        ALTER TABLE inventory 
        ADD COLUMN cost_price DECIMAL(10,2) DEFAULT 0.0 AFTER manufacturer_part_number
      `);
      console.log('✓ cost_price column added');
    } catch (error) {
      // Column might already exist, ignore duplicate column error
      if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column name')) {
        console.log('✓ cost_price column already exists');
      } else {
        console.log('Note: cost_price column check:', error.message);
      }
    }

    // Create purchase_orders table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        po_number VARCHAR(100) UNIQUE NOT NULL,
        order_type ENUM('customer', 'supplier') NOT NULL,
        customer_supplier_id VARCHAR(50),
        customer_supplier_name VARCHAR(255),
        status ENUM('approved', 'partially_delivered', 'delivered_completed') DEFAULT 'approved',
        total_amount DECIMAL(10,2) DEFAULT 0.0,
        linked_customer_po_id INT,
        created_by INT,
        approved_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_supplier_id) REFERENCES customers_suppliers(id) ON DELETE SET NULL,
        FOREIGN KEY (linked_customer_po_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    
    // Add linked_customer_po_id column if it doesn't exist (for existing databases)
    try {
      await connection.execute(`
        ALTER TABLE purchase_orders 
        ADD COLUMN linked_customer_po_id INT AFTER total_amount
      `);
      console.log('✓ linked_customer_po_id column added to purchase_orders table');
    } catch (error) {
      // Column might already exist, ignore duplicate column error
      if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column name')) {
        console.log('✓ linked_customer_po_id column already exists');
      } else {
        console.log('Note: linked_customer_po_id column check:', error.message);
      }
    }
    
    // Add foreign key constraint if it doesn't exist
    try {
      await connection.execute(`
        ALTER TABLE purchase_orders 
        ADD CONSTRAINT fk_linked_customer_po 
        FOREIGN KEY (linked_customer_po_id) REFERENCES purchase_orders(id) ON DELETE SET NULL
      `);
      console.log('✓ Foreign key constraint for linked_customer_po_id added');
    } catch (error) {
      // Constraint might already exist
      if (error.code === 'ER_DUP_KEY' || error.message.includes('Duplicate key name') || error.message.includes('already exists')) {
        console.log('✓ Foreign key constraint for linked_customer_po_id already exists');
      } else {
        console.log('Note: Foreign key constraint check:', error.message);
      }
    }

    // Create purchase_order_items table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        po_id INT NOT NULL,
        serial_no VARCHAR(100),
        project_no VARCHAR(100),
        date_po DATE,
        part_no VARCHAR(100),
        material_no VARCHAR(100),
        description TEXT,
        uom VARCHAR(50),
        quantity DECIMAL(10,2) DEFAULT 0,
        unit_price DECIMAL(10,2) DEFAULT 0.0,
        total_price DECIMAL(10,2) DEFAULT 0.0,
        lead_time VARCHAR(100),
        due_date DATE,
        penalty_percentage DECIMAL(5,2),
        penalty_amount DECIMAL(12,2),
        invoice_no VARCHAR(100),
        balance_quantity_undelivered DECIMAL(10,2),
        delivered_quantity DECIMAL(10,2),
        delivered_unit_price DECIMAL(10,2),
        delivered_total_price DECIMAL(12,2),
        comments TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
      )
    `);

    // Create po_documents table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS po_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        po_id INT NOT NULL,
        document_name VARCHAR(255) NOT NULL,
        document_path VARCHAR(500) NOT NULL,
        document_type ENUM('excel', 'pdf', 'image', 'other') DEFAULT 'excel',
        uploaded_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Create sales_tax_invoices table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sales_tax_invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_number VARCHAR(100) UNIQUE NOT NULL,
        invoice_date DATE NOT NULL,
        customer_id VARCHAR(50) NOT NULL,
        customer_po_number VARCHAR(100),
        customer_po_date DATE,
        payment_terms TEXT,
        contract_number VARCHAR(255),
        delivery_terms VARCHAR(100),
        claim_percentage DECIMAL(5,2) NOT NULL,
        subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        claim_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        vat_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        gross_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        amount_in_words TEXT,
        status ENUM('draft', 'sent', 'paid', 'cancelled') DEFAULT 'draft',
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers_suppliers(id) ON DELETE RESTRICT,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Create sales_tax_invoice_items table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sales_tax_invoice_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id INT NOT NULL,
        part_no VARCHAR(100),
        material_no VARCHAR(100),
        description TEXT,
        quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
        unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES sales_tax_invoices(id) ON DELETE CASCADE
      )
    `);

    // Create purchase_tax_invoices table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS purchase_tax_invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_number VARCHAR(100) UNIQUE NOT NULL,
        invoice_date DATE NOT NULL,
        supplier_id VARCHAR(50) NOT NULL,
        po_number VARCHAR(100),
        project_number VARCHAR(100),
        claim_percentage DECIMAL(5,2) NOT NULL DEFAULT 100.00,
        subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        vat_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        gross_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        status ENUM('draft', 'received', 'paid', 'cancelled') DEFAULT 'draft',
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES customers_suppliers(id) ON DELETE RESTRICT,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Create purchase_tax_invoice_items table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS purchase_tax_invoice_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id INT NOT NULL,
        serial_no VARCHAR(100),
        project_no VARCHAR(100),
        part_no VARCHAR(100),
        material_no VARCHAR(100),
        description TEXT,
        uom VARCHAR(50),
        quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
        supplier_unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        total_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES purchase_tax_invoices(id) ON DELETE CASCADE
      )
    `);

    // Create warranty_management table
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS warranty_management (
          id INT AUTO_INCREMENT PRIMARY KEY,
          sr_no VARCHAR(100),
          part_no VARCHAR(100),
          material_no VARCHAR(100),
          description TEXT,
          project_no VARCHAR(100),
          part_cost DECIMAL(10,2) DEFAULT 0.00,
          serial_number VARCHAR(100),
          warranty_start_date DATE,
          warranty_end_date DATE,
          remarks TEXT,
          warranty_type ENUM('sales', 'purchase') NOT NULL DEFAULT 'sales',
          linked_po_id INT,
          linked_invoice_id INT,
          linked_invoice_type ENUM('sales', 'purchase'),
          created_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (linked_po_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `);
      console.log('✓ Warranty Management table created');
    } catch (error) {
      // If foreign keys fail, create without them
      try {
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS warranty_management (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sr_no VARCHAR(100),
            part_no VARCHAR(100),
            material_no VARCHAR(100),
            description TEXT,
            project_no VARCHAR(100),
            part_cost DECIMAL(10,2) DEFAULT 0.00,
            serial_number VARCHAR(100),
            warranty_start_date DATE,
            warranty_end_date DATE,
            remarks TEXT,
            warranty_type ENUM('sales', 'purchase') NOT NULL DEFAULT 'sales',
            linked_po_id INT,
            linked_invoice_id INT,
            linked_invoice_type ENUM('sales', 'purchase'),
            created_by INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `);
        console.log('✓ Warranty Management table created (without foreign keys)');
      } catch (fallbackError) {
        console.error('Error creating warranty_management table:', fallbackError.message);
      }
    }

    // Insert default admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await connection.execute(`
      INSERT IGNORE INTO users (username, email, password, role)
      VALUES ('admin', 'admin@example.com', ?, 'admin')
    `, [hashedPassword]);

    await connection.end();

    res.json({
      success: true,
      message: 'Database initialized successfully!',
      tables: [
        'users',
        'customers_suppliers',
        'inventory',
        'purchase_orders',
        'purchase_order_items',
        'po_documents',
        'sales_tax_invoices',
        'sales_tax_invoice_items',
        'purchase_tax_invoices',
        'purchase_tax_invoice_items',
        'warranty_management',
        'customer_supplier_documents'
      ],
      adminUser: {
        username: 'admin',
        password: 'admin123',
        note: 'Please change the password after first login'
      },
      warning: 'IMPORTANT: Remove the /api/initialize-database endpoint from server.js after running this once!'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database initialization failed',
      error: error.message
    });
  }
});

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
  const frontendBuildPath = path.join(__dirname, '../frontend/build');

  // Serve static files
  app.use(express.static(frontendBuildPath));

  // Handle React routing, return all requests to React app (except API routes)
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });

  console.log('Production mode: Serving frontend from', frontendBuildPath);
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing server gracefully...');
  await pool.end();
  process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`CORS origins: ${allowedOrigins.join(', ')}`);
});

module.exports = app;
