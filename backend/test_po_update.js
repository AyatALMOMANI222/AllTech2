const fetch = require('node-fetch');

async function testPurchaseOrderUpdate() {
  try {
    console.log('Testing Purchase Order Update with Delivered Status...\n');
    
    // Test data with delivered status and penalty fields
    const testData = {
      po_number: 'PO-TEST-001',
      order_type: 'supplier',
      customer_supplier_id: '1',
      status: 'delivered',
      penalty_percentage: '5.0',
      penalty_amount: '125.50',
      balance_quantity_undelivered: '10',
      lead_time: '7 days',
      due_date: '2025-01-25',
      items: [
        {
          serial_no: 'SN001',
          project_no: 'PRJ001',
          date_po: '2025-01-20',
          part_no: 'PN001',
          material_no: 'M001',
          description: 'Test Widget',
          uom: 'pcs',
          quantity: 100,
          unit_price: 25.50,
          total_price: 2550.00,
          comments: 'Test order'
        }
      ]
    };
    
    console.log('Test Data:', JSON.stringify(testData, null, 2));
    
    // First create a new PO
    console.log('\n1. Creating new Purchase Order...');
    const createResponse = await fetch('http://localhost:8000/api/purchase-orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Create failed:', errorText);
      return;
    }
    
    const createResult = await createResponse.json();
    console.log('✅ Created PO with ID:', createResult.id);
    
    // Now update it to delivered status with penalty fields
    console.log('\n2. Updating to delivered status with penalty fields...');
    const updateResponse = await fetch(`http://localhost:8000/api/purchase-orders/${createResult.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...testData,
        penalty_percentage: '10.0',
        penalty_amount: '255.00',
        balance_quantity_undelivered: '5',
        lead_time: '14 days'
      })
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('Update failed:', errorText);
      return;
    }
    
    const updateResult = await updateResponse.json();
    console.log('✅ Updated PO:', updateResult);
    
    // Verify the data was saved
    console.log('\n3. Verifying data in database...');
    const verifyResponse = await fetch(`http://localhost:8000/api/purchase-orders/${createResult.id}`);
    
    if (!verifyResponse.ok) {
      console.error('Verify failed');
      return;
    }
    
    const verifyResult = await verifyResponse.json();
    console.log('✅ Verification result:', JSON.stringify(verifyResult, null, 2));
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testPurchaseOrderUpdate();
