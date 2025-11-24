const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function fixTriggers() {
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
    
    console.log('Dropping existing triggers...');
    await connection.query('DROP TRIGGER IF EXISTS update_purchase_order_status_after_invoice_insert');
    await connection.query('DROP TRIGGER IF EXISTS update_purchase_order_status_after_invoice_update');
    await connection.query('DROP TRIGGER IF EXISTS update_purchase_order_status_after_invoice_delete');
    console.log('✓ Old triggers dropped');
    
    console.log('Creating new triggers...');
    
    // Create INSERT trigger
    await connection.query(`
      CREATE TRIGGER update_purchase_order_status_after_invoice_insert
      AFTER INSERT ON purchase_tax_invoice_items
      FOR EACH ROW
      BEGIN
        DECLARE po_id_var INT;
        DECLARE po_number_var VARCHAR(100);
        
        SELECT po.id, po.po_number INTO po_id_var, po_number_var
        FROM purchase_tax_invoices pt
        INNER JOIN purchase_orders po ON pt.po_number = po.po_number AND po.order_type = 'supplier'
        WHERE pt.id = NEW.invoice_id
        LIMIT 1;
        
        IF po_id_var IS NOT NULL THEN
          CALL update_purchase_order_status_fn(po_id_var);
        END IF;
      END
    `);
    console.log('✓ INSERT trigger created');
    
    // Create UPDATE trigger
    await connection.query(`
      CREATE TRIGGER update_purchase_order_status_after_invoice_update
      AFTER UPDATE ON purchase_tax_invoice_items
      FOR EACH ROW
      BEGIN
        DECLARE po_id_var INT;
        DECLARE po_number_var VARCHAR(100);
        
        SELECT po.id, po.po_number INTO po_id_var, po_number_var
        FROM purchase_tax_invoices pt
        INNER JOIN purchase_orders po ON pt.po_number = po.po_number AND po.order_type = 'supplier'
        WHERE pt.id = NEW.invoice_id
        LIMIT 1;
        
        IF po_id_var IS NOT NULL THEN
          CALL update_purchase_order_status_fn(po_id_var);
        END IF;
      END
    `);
    console.log('✓ UPDATE trigger created');
    
    // Create DELETE trigger
    await connection.query(`
      CREATE TRIGGER update_purchase_order_status_after_invoice_delete
      AFTER DELETE ON purchase_tax_invoice_items
      FOR EACH ROW
      BEGIN
        DECLARE po_id_var INT;
        DECLARE po_number_var VARCHAR(100);
        
        SELECT po.id, po.po_number INTO po_id_var, po_number_var
        FROM purchase_tax_invoices pt
        INNER JOIN purchase_orders po ON pt.po_number = po.po_number AND po.order_type = 'supplier'
        WHERE pt.id = OLD.invoice_id
        LIMIT 1;
        
        IF po_id_var IS NOT NULL THEN
          CALL update_purchase_order_status_fn(po_id_var);
        END IF;
      END
    `);
    console.log('✓ DELETE trigger created');
    
    console.log('\n✅ All triggers fixed successfully!');
    console.log('You can now try creating a purchase tax invoice again.');
    
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

fixTriggers();

