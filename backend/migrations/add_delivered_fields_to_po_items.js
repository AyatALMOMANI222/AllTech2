const mysql = require('mysql2/promise');
require('dotenv').config();

async function addDeliveredFields() {
  let connection;
  
  try {
    // Create connection with same config as server.js
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '1335293',
      database: process.env.DB_NAME || 'management'
    });

    console.log('Connected to database. Adding delivered fields to purchase_order_items table...');

    // Check if columns already exist before adding them
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'purchase_order_items' 
      AND COLUMN_NAME IN ('delivered_quantity', 'delivered_unit_price', 'delivered_total_price')
    `);

    const existingColumns = columns.map(col => col.COLUMN_NAME);

    // Add delivered_quantity if it doesn't exist
    if (!existingColumns.includes('delivered_quantity')) {
      await connection.execute(`
        ALTER TABLE purchase_order_items 
        ADD COLUMN delivered_quantity DECIMAL(10,2) DEFAULT NULL 
        AFTER balance_quantity_undelivered
      `);
      console.log('✅ Added delivered_quantity column');
    } else {
      console.log('⚠️  delivered_quantity column already exists');
    }

    // Add delivered_unit_price if it doesn't exist
    if (!existingColumns.includes('delivered_unit_price')) {
      await connection.execute(`
        ALTER TABLE purchase_order_items 
        ADD COLUMN delivered_unit_price DECIMAL(10,2) DEFAULT NULL 
        AFTER delivered_quantity
      `);
      console.log('✅ Added delivered_unit_price column');
    } else {
      console.log('⚠️  delivered_unit_price column already exists');
    }

    // Add delivered_total_price if it doesn't exist
    if (!existingColumns.includes('delivered_total_price')) {
      await connection.execute(`
        ALTER TABLE purchase_order_items 
        ADD COLUMN delivered_total_price DECIMAL(12,2) DEFAULT NULL 
        AFTER delivered_unit_price
      `);
      console.log('✅ Added delivered_total_price column');
    } else {
      console.log('⚠️  delivered_total_price column already exists');
    }

    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error running migration:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

// Run the migration
addDeliveredFields()
  .then(() => {
    console.log('Migration finished.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

