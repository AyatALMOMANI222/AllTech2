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
        country VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Customers/Suppliers table created');
    
    // Add country column if it doesn't exist (for existing databases)
    try {
      await connection.execute(`
        ALTER TABLE customers_suppliers 
        ADD COLUMN country VARCHAR(100) AFTER document_attachment
      `);
      console.log('✓ country column added');
    } catch (error) {
      // Column might already exist, ignore duplicate column error
      if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column name')) {
        console.log('✓ country column already exists');
      } else {
        console.log('Note: country column check:', error.message);
      }
    }

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
    console.log('✓ Inventory table created');
    
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
    console.log('✓ Purchase Orders table created');
    
    // Add linked_customer_po_id column if it doesn't exist (for existing databases)
    try {
      await connection.execute(`
        ALTER TABLE purchase_orders 
        ADD COLUMN linked_customer_po_id INT AFTER total_amount
      `);
      console.log('✓ linked_customer_po_id column added');
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
    console.log('✓ Purchase Order Items table created');

    // Create po_documents table
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
    
    // Add amount_paid column if it doesn't exist (for existing databases)
    try {
      await connection.execute(`
        ALTER TABLE sales_tax_invoices 
        ADD COLUMN amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER gross_total
      `);
      console.log('✓ amount_paid column added to sales_tax_invoices table');
    } catch (error) {
      // Column might already exist, ignore duplicate column error
      if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column name')) {
        console.log('✓ amount_paid column already exists in sales_tax_invoices table');
      } else {
        console.log('Note: amount_paid column check for sales_tax_invoices:', error.message);
      }
    }

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
    
    // Add amount_paid column if it doesn't exist (for existing databases)
    try {
      await connection.execute(`
        ALTER TABLE purchase_tax_invoices 
        ADD COLUMN amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER gross_total
      `);
      console.log('✓ amount_paid column added to purchase_tax_invoices table');
    } catch (error) {
      // Column might already exist, ignore duplicate column error
      if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column name')) {
        console.log('✓ amount_paid column already exists in purchase_tax_invoices table');
      } else {
        console.log('Note: amount_paid column check for purchase_tax_invoices:', error.message);
      }
    }

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
    console.log('✓ Warranty Management table created');

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
    console.log('✓ All 11 tables created');
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
