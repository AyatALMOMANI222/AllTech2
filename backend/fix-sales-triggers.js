const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function fixSalesTriggers() {
  let connection;
  
  try {
    // Database connection
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'management',
      multipleStatements: true // Important for triggers
    };
    
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database');
    
    console.log('Dropping existing sales tax invoice triggers...');
    await connection.query('DROP TRIGGER IF EXISTS update_sales_order_status_after_invoice_insert');
    await connection.query('DROP TRIGGER IF EXISTS update_sales_order_status_after_invoice_update');
    await connection.query('DROP TRIGGER IF EXISTS update_sales_order_status_after_invoice_delete');
    console.log('✓ Old triggers dropped');
    
    console.log('Creating new triggers...');
    
    // Create INSERT trigger
    await connection.query(`
      CREATE TRIGGER update_sales_order_status_after_invoice_insert
      AFTER INSERT ON sales_tax_invoice_items
      FOR EACH ROW
      BEGIN
        DECLARE po_id_var INT;
        DECLARE po_number_var VARCHAR(100);
        
        SELECT po.id, po.po_number INTO po_id_var, po_number_var
        FROM sales_tax_invoices sti
        INNER JOIN purchase_orders po ON sti.customer_po_number = po.po_number AND po.order_type = 'customer'
        WHERE sti.id = NEW.invoice_id
        LIMIT 1;
        
        IF po_id_var IS NOT NULL THEN
          CALL update_purchase_order_status_fn(po_id_var);
        END IF;
      END
    `);
    console.log('✓ INSERT trigger created');
    
    // Create UPDATE trigger
    await connection.query(`
      CREATE TRIGGER update_sales_order_status_after_invoice_update
      AFTER UPDATE ON sales_tax_invoice_items
      FOR EACH ROW
      BEGIN
        DECLARE po_id_var INT;
        DECLARE po_number_var VARCHAR(100);
        
        SELECT po.id, po.po_number INTO po_id_var, po_number_var
        FROM sales_tax_invoices sti
        INNER JOIN purchase_orders po ON sti.customer_po_number = po.po_number AND po.order_type = 'customer'
        WHERE sti.id = NEW.invoice_id
        LIMIT 1;
        
        IF po_id_var IS NOT NULL THEN
          CALL update_purchase_order_status_fn(po_id_var);
        END IF;
      END
    `);
    console.log('✓ UPDATE trigger created');
    
    // Create DELETE trigger
    await connection.query(`
      CREATE TRIGGER update_sales_order_status_after_invoice_delete
      AFTER DELETE ON sales_tax_invoice_items
      FOR EACH ROW
      BEGIN
        DECLARE po_id_var INT;
        DECLARE po_number_var VARCHAR(100);
        
        SELECT po.id, po.po_number INTO po_id_var, po_number_var
        FROM sales_tax_invoices sti
        INNER JOIN purchase_orders po ON sti.customer_po_number = po.po_number AND po.order_type = 'customer'
        WHERE sti.id = OLD.invoice_id
        LIMIT 1;
        
        IF po_id_var IS NOT NULL THEN
          CALL update_purchase_order_status_fn(po_id_var);
        END IF;
      END
    `);
    console.log('✓ DELETE trigger created');
    
    console.log('\n✅ All sales tax invoice triggers fixed successfully!');
    console.log('You can now try creating a sales tax invoice again.');
    
  } catch (error) {
    console.error('❌ Error fixing triggers:', error.message);
    console.error('Error code:', error.code);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixSalesTriggers();


