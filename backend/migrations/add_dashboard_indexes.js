/**
 * Migration: Add indexes for database dashboard performance optimization
 * 
 * This migration adds indexes on frequently searched and joined columns
 * to significantly improve query performance for the database dashboard.
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'alltech_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

async function addIndexes() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ Connected to database');
    
    // Indexes for purchase_order_items table
    console.log('\n📊 Adding indexes to purchase_order_items table...');
    
    // Index on po_id (most common join)
    try {
      await connection.execute(`
        CREATE INDEX idx_poi_po_id ON purchase_order_items(po_id)
      `);
      console.log('  ✓ Created index: idx_poi_po_id');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME' || error.message.includes('Duplicate key name')) {
        console.log('  ✓ Index idx_poi_po_id already exists');
      } else {
        console.log('  ⚠️  Error creating idx_poi_po_id:', error.message);
      }
    }
    
    // Composite index for search fields (part_no, material_no)
    try {
      await connection.execute(`
        CREATE INDEX idx_poi_part_material ON purchase_order_items(part_no, material_no)
      `);
      console.log('  ✓ Created index: idx_poi_part_material');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME' || error.message.includes('Duplicate key name')) {
        console.log('  ✓ Index idx_poi_part_material already exists');
      } else {
        console.log('  ⚠️  Error creating idx_poi_part_material:', error.message);
      }
    }
    
    // Index on project_no for filtering
    try {
      await connection.execute(`
        CREATE INDEX idx_poi_project_no ON purchase_order_items(project_no)
      `);
      console.log('  ✓ Created index: idx_poi_project_no');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME' || error.message.includes('Duplicate key name')) {
        console.log('  ✓ Index idx_poi_project_no already exists');
      } else {
        console.log('  ⚠️  Error creating idx_poi_project_no:', error.message);
      }
    }
    
    // Index on serial_no for search
    try {
      await connection.execute(`
        CREATE INDEX idx_poi_serial_no ON purchase_order_items(serial_no)
      `);
      console.log('  ✓ Created index: idx_poi_serial_no');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME' || error.message.includes('Duplicate key name')) {
        console.log('  ✓ Index idx_poi_serial_no already exists');
      } else {
        console.log('  ⚠️  Error creating idx_poi_serial_no:', error.message);
      }
    }
    
    // Index on date_po for date filtering
    try {
      await connection.execute(`
        CREATE INDEX idx_poi_date_po ON purchase_order_items(date_po)
      `);
      console.log('  ✓ Created index: idx_poi_date_po');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME' || error.message.includes('Duplicate key name')) {
        console.log('  ✓ Index idx_poi_date_po already exists');
      } else {
        console.log('  ⚠️  Error creating idx_poi_date_po:', error.message);
      }
    }
    
    // Indexes for purchase_orders table
    console.log('\n📊 Adding indexes to purchase_orders table...');
    
    // Index on status (frequently filtered)
    try {
      await connection.execute(`
        CREATE INDEX idx_po_status ON purchase_orders(status)
      `);
      console.log('  ✓ Created index: idx_po_status');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME' || error.message.includes('Duplicate key name')) {
        console.log('  ✓ Index idx_po_status already exists');
      } else {
        console.log('  ⚠️  Error creating idx_po_status:', error.message);
      }
    }
    
    // Composite index for order_type and status (common filter combination)
    try {
      await connection.execute(`
        CREATE INDEX idx_po_order_type_status ON purchase_orders(order_type, status)
      `);
      console.log('  ✓ Created index: idx_po_order_type_status');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME' || error.message.includes('Duplicate key name')) {
        console.log('  ✓ Index idx_po_order_type_status already exists');
      } else {
        console.log('  ⚠️  Error creating idx_po_order_type_status:', error.message);
      }
    }
    
    // Index on linked_customer_po_id for joins
    try {
      await connection.execute(`
        CREATE INDEX idx_po_linked_customer_po_id ON purchase_orders(linked_customer_po_id)
      `);
      console.log('  ✓ Created index: idx_po_linked_customer_po_id');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME' || error.message.includes('Duplicate key name')) {
        console.log('  ✓ Index idx_po_linked_customer_po_id already exists');
      } else {
        console.log('  ⚠️  Error creating idx_po_linked_customer_po_id:', error.message);
      }
    }
    
    // Index on created_at for date filtering
    try {
      await connection.execute(`
        CREATE INDEX idx_po_created_at ON purchase_orders(created_at)
      `);
      console.log('  ✓ Created index: idx_po_created_at');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME' || error.message.includes('Duplicate key name')) {
        console.log('  ✓ Index idx_po_created_at already exists');
      } else {
        console.log('  ⚠️  Error creating idx_po_created_at:', error.message);
      }
    }
    
    // Index on po_number for search
    try {
      await connection.execute(`
        CREATE INDEX idx_po_po_number ON purchase_orders(po_number)
      `);
      console.log('  ✓ Created index: idx_po_po_number');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME' || error.message.includes('Duplicate key name')) {
        console.log('  ✓ Index idx_po_po_number already exists');
      } else {
        console.log('  ⚠️  Error creating idx_po_po_number:', error.message);
      }
    }
    
    // Indexes for invoice tables (for joins)
    console.log('\n📊 Adding indexes to invoice tables...');
    
    // Purchase tax invoice items
    try {
      await connection.execute(`
        CREATE INDEX idx_ptii_part_material ON purchase_tax_invoice_items(part_no, material_no)
      `);
      console.log('  ✓ Created index: idx_ptii_part_material');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME' || error.message.includes('Duplicate key name')) {
        console.log('  ✓ Index idx_ptii_part_material already exists');
      } else {
        console.log('  ⚠️  Error creating idx_ptii_part_material:', error.message);
      }
    }
    
    // Sales tax invoice items
    try {
      await connection.execute(`
        CREATE INDEX idx_stii_part_material ON sales_tax_invoice_items(part_no, material_no)
      `);
      console.log('  ✓ Created index: idx_stii_part_material');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME' || error.message.includes('Duplicate key name')) {
        console.log('  ✓ Index idx_stii_part_material already exists');
      } else {
        console.log('  ⚠️  Error creating idx_stii_part_material:', error.message);
      }
    }
    
    // Index on inventory table for joins
    try {
      await connection.execute(`
        CREATE INDEX idx_inv_part_material_project ON inventory(part_no, material_no, project_no)
      `);
      console.log('  ✓ Created index: idx_inv_part_material_project');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME' || error.message.includes('Duplicate key name')) {
        console.log('  ✓ Index idx_inv_part_material_project already exists');
      } else {
        console.log('  ⚠️  Error creating idx_inv_part_material_project:', error.message);
      }
    }
    
    console.log('\n✅ All indexes added successfully!');
    console.log('📈 Database dashboard queries should now perform significantly faster.\n');
    
  } catch (error) {
    console.error('❌ Error adding indexes:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('✓ Database connection closed');
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  addIndexes()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addIndexes };

