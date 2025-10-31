const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

(async () => {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '1335293',
      database: process.env.DB_NAME || 'management'
    });
    
    console.log('Updating purchase_orders status ENUM...');
    
    // First, update any existing 'delivered' status to 'delivered_completed'
    await connection.execute(
      `UPDATE purchase_orders SET status = 'delivered_completed' WHERE status = 'delivered'`
    );
    console.log('✓ Updated existing "delivered" status to "delivered_completed"');
    
    // Modify the ENUM to include new values
    await connection.execute(`
      ALTER TABLE purchase_orders 
      MODIFY COLUMN status ENUM('approved', 'partially_delivered', 'delivered_completed') 
      DEFAULT 'approved'
    `);
    
    console.log('✓ Successfully updated purchase_orders status ENUM');
    console.log('  New values: approved, partially_delivered, delivered_completed');
    
    await connection.end();
  } catch (error) {
    console.error('Error updating ENUM:', error.message);
    if (connection) await connection.end();
    process.exit(1);
  }
})();

