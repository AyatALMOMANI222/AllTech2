const fetch = require('node-fetch');

async function testDashboardPenaltyFields() {
  try {
    console.log('Testing Dashboard Penalty Fields Display...\n');
    
    // Test the dashboard API
    console.log('1. Fetching dashboard data...');
    const dashboardResponse = await fetch('http://localhost:8000/api/database-dashboard');
    
    if (!dashboardResponse.ok) {
      console.error('Failed to fetch dashboard data');
      return;
    }
    
    const dashboardData = await dashboardResponse.json();
    console.log('✅ Dashboard data fetched successfully');
    console.log('Total items:', dashboardData.length);
    
    // Look for items with delivered purchase orders
    console.log('\n2. Checking for delivered purchase orders...');
    let foundDeliveredOrders = false;
    
    dashboardData.forEach((item, index) => {
      if (item.supplier && item.supplier.delivered_purchase_orders && item.supplier.delivered_purchase_orders.length > 0) {
        foundDeliveredOrders = true;
        console.log(`\nItem ${index + 1}: ${item.part_no} - ${item.material_no}`);
        console.log('Delivered Purchase Orders:', item.supplier.delivered_purchase_orders.length);
        
        item.supplier.delivered_purchase_orders.forEach((order, orderIndex) => {
          console.log(`  Order ${orderIndex + 1}:`);
          console.log(`    Quantity: ${order.quantity}`);
          console.log(`    Unit Price: ${order.unit_price}`);
          console.log(`    Total Price: ${order.total_price}`);
          console.log(`    Penalty %: ${order.penalty_percentage}`);
          console.log(`    Penalty Amount: ${order.penalty_amount}`);
          console.log(`    Invoice No: ${order.invoice_no}`);
          console.log(`    Balance Quantity Undelivered: ${order.balance_quantity_undelivered}`);
          console.log(`    Supplier Name: ${order.supplier_name}`);
        });
      }
    });
    
    if (!foundDeliveredOrders) {
      console.log('❌ No delivered purchase orders found in dashboard data');
      console.log('\n3. Creating a test delivered order...');
      
      // Create a test PO and mark it as delivered
      const testData = {
        po_number: 'PO-DASHBOARD-TEST-001',
        order_type: 'supplier',
        customer_supplier_id: '1',
        status: 'delivered',
        penalty_percentage: '5.0',
        penalty_amount: '127.50',
        balance_quantity_undelivered: '10',
        lead_time: '7 days',
        due_date: '2025-01-25',
        items: [
          {
            serial_no: 'SN001',
            project_no: 'PRJ001',
            date_po: '2025-01-20',
            part_no: 'PN-DASHBOARD-TEST',
            material_no: 'M-DASHBOARD-TEST',
            description: 'Dashboard Test Widget',
            uom: 'pcs',
            quantity: 100,
            unit_price: 25.50,
            total_price: 2550.00,
            comments: 'Test for dashboard display'
          }
        ]
      };
      
      const createResponse = await fetch('http://localhost:8000/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });
      
      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('Failed to create test PO:', errorText);
        return;
      }
      
      const createResult = await createResponse.json();
      console.log('✅ Created test PO with ID:', createResult.id);
      
      // Wait a moment for the data to be processed
      console.log('\n4. Waiting for data to be processed...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Fetch dashboard data again
      console.log('\n5. Fetching updated dashboard data...');
      const updatedDashboardResponse = await fetch('http://localhost:8000/api/database-dashboard');
      
      if (!updatedDashboardResponse.ok) {
        console.error('Failed to fetch updated dashboard data');
        return;
      }
      
      const updatedDashboardData = await updatedDashboardResponse.json();
      
      // Look for our test item
      const testItem = updatedDashboardData.find(item => 
        item.part_no === 'PN-DASHBOARD-TEST' && item.material_no === 'M-DASHBOARD-TEST'
      );
      
      if (testItem && testItem.supplier && testItem.supplier.delivered_purchase_orders) {
        console.log('✅ Test item found in dashboard!');
        console.log('Penalty fields:');
        console.log(`  Penalty %: ${testItem.supplier.delivered_purchase_orders[0]?.penalty_percentage}`);
        console.log(`  Penalty Amount: ${testItem.supplier.delivered_purchase_orders[0]?.penalty_amount}`);
        console.log(`  Balance Quantity Undelivered: ${testItem.supplier.delivered_purchase_orders[0]?.balance_quantity_undelivered}`);
        console.log(`  Lead Time: ${testItem.supplier.delivered_purchase_orders[0]?.lead_time}`);
      } else {
        console.log('❌ Test item not found in dashboard data');
      }
    } else {
      console.log('✅ Found delivered purchase orders with penalty fields!');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testDashboardPenaltyFields();
