const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function checkTriggerContent() {
  let connection;
  
  try {
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'management'
    };
    
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database');
    
    // Get trigger definitions
    const [triggers] = await connection.execute(`
      SELECT TRIGGER_NAME, EVENT_MANIPULATION, ACTION_STATEMENT
      FROM information_schema.TRIGGERS
      WHERE TRIGGER_SCHEMA = DATABASE()
      AND EVENT_OBJECT_TABLE = 'sales_tax_invoice_items'
    `);
    
    console.log('\n=== Sales Tax Invoice Items Triggers ===');
    triggers.forEach(t => {
      console.log(`\n${t.TRIGGER_NAME} (${t.EVENT_MANIPULATION}):`);
      console.log(t.ACTION_STATEMENT);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkTriggerContent();

