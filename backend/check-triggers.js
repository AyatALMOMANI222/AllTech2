const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function checkTriggers() {
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
    
    // Check triggers on sales_tax_invoice_items
    console.log('\n=== Triggers on sales_tax_invoice_items ===');
    const [salesTriggers] = await connection.execute(
      'SHOW TRIGGERS WHERE `Table` = ?',
      ['sales_tax_invoice_items']
    );
    
    if (salesTriggers.length === 0) {
      console.log('No triggers found on sales_tax_invoice_items');
    } else {
      salesTriggers.forEach(t => {
        console.log(`- ${t.Trigger} (${t.Event} ${t.Timing})`);
      });
    }
    
    // Check triggers on purchase_tax_invoice_items
    console.log('\n=== Triggers on purchase_tax_invoice_items ===');
    const [purchaseTriggers] = await connection.execute(
      'SHOW TRIGGERS WHERE `Table` = ?',
      ['purchase_tax_invoice_items']
    );
    
    if (purchaseTriggers.length === 0) {
      console.log('No triggers found on purchase_tax_invoice_items');
    } else {
      purchaseTriggers.forEach(t => {
        console.log(`- ${t.Trigger} (${t.Event} ${t.Timing})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkTriggers();



