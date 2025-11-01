const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function initializeDatabase() {
  try {
    // Parse DATABASE_URL if provided (Railway format)
    let dbConfig;

    if (process.env.DATABASE_URL) {
      // Railway provides DATABASE_URL
      const url = process.env.DATABASE_URL;
      const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
      if (match) {
        dbConfig = {
          host: match[3],
          port: parseInt(match[4]),
          user: match[1],
          password: match[2],
          database: match[5] // Use the database from URL (railway)
        };
        console.log('✓ Using DATABASE_URL from Railway');
        console.log(`✓ Database: ${dbConfig.database}`);
      }
    } else {
      // Local development - use environment variables
      dbConfig = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USERNAME || process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'alltech_business'
      };
      console.log('✓ Using local database configuration');
    }

    console.log(`Connecting to database at ${dbConfig.host}...`);

    // Connect directly to the database (don't create new one)
    const connection = await mysql.createConnection(dbConfig);
    console.log(`✓ Connected to database '${dbConfig.database}'`);

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
    console.log('✓ Users table created');

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
    console.log('✓ Customers/Suppliers table created');

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
    console.log('✓ Inventory table created');

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
    console.log('✓ Purchase Orders table created');

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
    console.log('✓ Purchase Order Items table created');

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
    console.log('✓ PO Documents table created');

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
    console.log('✓ Sales Tax Invoices table created');

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
    console.log('✓ Sales Tax Invoice Items table created');

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
    console.log('✓ Purchase Tax Invoices table created');

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
    console.log('✓ Purchase Tax Invoice Items table created');

    // Insert default admin user
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);

    await connection.execute(`
      INSERT IGNORE INTO users (username, email, password, role)
      VALUES ('admin', 'admin@example.com', ?, 'admin')
    `, [hashedPassword]);

    console.log('\n==============================================');
    console.log('✅ Database initialization completed successfully!');
    console.log('==============================================');
    console.log('✓ All 10 tables created');
    console.log('✓ Default admin user created:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('==============================================\n');

    await connection.end();
  } catch (error) {
    console.error('\n❌ Error initializing database:');
    console.error(error.message);
    console.error('\nPlease check your database configuration and try again.');
    process.exit(1);
  }
}

initializeDatabase();
