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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

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
        created_by INT,
        approved_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_supplier_id) REFERENCES customers_suppliers(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

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
        'purchase_tax_invoice_items'
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
