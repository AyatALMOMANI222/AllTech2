const mysql = require('mysql2/promise');

(async () => {
  const c = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '1335293',
    database: 'management'
  });
  
  try {
    console.log('Testing GROUP_CONCAT for Purchase Orders...\n');
    
    // Test the exact query from the API
    const query = `
      SELECT 
        i.id as inventory_id,
        i.part_no,
        GROUP_CONCAT(DISTINCT CASE 
          WHEN po_purchase.id IS NOT NULL AND po_purchase.status = 'approved'
          THEN CONCAT(
            poi_purchase.quantity, '|',
            poi_purchase.unit_price, '|',
            poi_purchase.total_price, '|',
            COALESCE(poi_purchase.lead_time, ''), '|',
            COALESCE(poi_purchase.due_date, ''), '|',
            COALESCE(cs_supplier.company_name, '')
          )
          ELSE NULL 
        END SEPARATOR '||') as approved_purchase_data
      FROM inventory i
      LEFT JOIN purchase_order_items poi_purchase 
        ON i.part_no = poi_purchase.part_no 
        AND (i.material_no = poi_purchase.material_no OR (i.material_no IS NULL AND poi_purchase.material_no IS NULL))
      LEFT JOIN purchase_orders po_purchase 
        ON poi_purchase.po_id = po_purchase.id AND po_purchase.order_type = 'supplier'
      LEFT JOIN customers_suppliers cs_supplier 
        ON po_purchase.customer_supplier_id = cs_supplier.id
      WHERE i.id IN (78, 79, 80)
      GROUP BY i.id
    `;
    
    const [result] = await c.execute(query);
    
    console.log('Results:');
    result.forEach(row => {
      console.log(`  ID: ${row.inventory_id}, Part: ${row.part_no}, Data: ${row.approved_purchase_data || 'NULL'}`);
    });
    
    // Now test with customer orders
    const query2 = `
      SELECT 
        i.id as inventory_id,
        i.part_no,
        GROUP_CONCAT(DISTINCT CASE 
          WHEN po_sales.id IS NOT NULL AND po_sales.status = 'approved'
          THEN CONCAT(
            poi_sales.quantity, '|',
            poi_sales.unit_price, '|',
            poi_sales.total_price, '|',
            COALESCE(poi_sales.lead_time, ''), '|',
            COALESCE(poi_sales.due_date, ''), '|',
            COALESCE(cs_customer.company_name, '')
          )
          ELSE NULL 
        END SEPARATOR '||') as approved_sales_data
      FROM inventory i
      LEFT JOIN purchase_order_items poi_sales 
        ON i.part_no = poi_sales.part_no 
        AND (i.material_no = poi_sales.material_no OR (i.material_no IS NULL AND poi_sales.material_no IS NULL))
      LEFT JOIN purchase_orders po_sales 
        ON poi_sales.po_id = po_sales.id AND po_sales.order_type = 'customer'
      LEFT JOIN customers_suppliers cs_customer 
        ON po_sales.customer_supplier_id = cs_customer.id
      WHERE i.id IN (78, 79, 80)
      GROUP BY i.id
    `;
    
    const [result2] = await c.execute(query2);
    
    console.log('\nCustomer Orders:');
    result2.forEach(row => {
      console.log(`  ID: ${row.inventory_id}, Part: ${row.part_no}, Data: ${row.approved_sales_data || 'NULL'}`);
    });
    
    await c.end();
  } catch (error) {
    console.error('Error:', error.message);
    await c.end();
  }
})();



