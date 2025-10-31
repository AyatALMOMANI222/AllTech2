const fetch = require('node-fetch');

async function testPurchaseOrderUpdateFix() {
  try {
    console.log('Testing Purchase Order Update Fix...\n');
    
    // First, let's get an existing PO to test with
    console.log('1. Getting existing Purchase Orders...');
    const listResponse = await fetch('http://localhost:8000/api/purchase-orders');
    
    if (!listResponse.ok) {
      console.error('Failed to get PO list');
      return;
    }
    
    const poList = await listResponse.json();
    console.log('Found', poList.length, 'Purchase Orders');
    
    if (poList.length === 0) {
      console.log('No existing POs found. Creating one first...');
      
      // Create a test PO
      const createData = {
        po_number: 'PO-TEST-FIX-001',
        order_type: 'supplier',
        customer_supplier_id: '1',
        status: 'approved',
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
            comments: 'Test order for fix'
          }
        ]
      };
      
      const createResponse = await fetch('http://localhost:8000/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createData)
      });
      
      if (!createResponse.ok) {
        console.error('Failed to create test PO');
        return;
      }
      
      const createResult = await createResponse.json();
      console.log('✅ Created test PO with ID:', createResult.id);
      
      // Use the created PO for testing
      var testPOId = createResult.id;
    } else {
      // Use the first existing PO
      testPOId = poList[0].id;
      console.log('Using existing PO ID:', testPOId);
    }
    
    // Now test the update with delivered status and penalty fields
    console.log('\n2. Testing update to delivered status with penalty fields...');
    
    const updateData = {
      po_number: 'PO-TEST-FIX-001',
      order_type: 'supplier',
      customer_supplier_id: '1',
      status: 'delivered',
      penalty_percentage: '5.0',
      penalty_amount: '127.50',
      balance_quantity_undelivered: '10',
      lead_time: '7 days',
      due_date: '2025-01-25'
      // Note: No items array - this tests the form-level field update
    };
    
    console.log('Update payload:', JSON.stringify(updateData, null, 2));
    
    const updateResponse = await fetch(`http://localhost:8000/api/purchase-orders/${testPOId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('❌ Update failed:', errorText);
      return;
    }
    
    const updateResult = await updateResponse.json();
    console.log('✅ Update response:', updateResult);
    
    // Verify the data was saved
    console.log('\n3. Verifying data in database...');
    const verifyResponse = await fetch(`http://localhost:8000/api/purchase-orders/${testPOId}`);
    
    if (!verifyResponse.ok) {
      console.error('❌ Verification failed');
      return;
    }
    
    const verifyResult = await verifyResponse.json();
    console.log('✅ Verification result:');
    console.log('PO Status:', verifyResult.status);
    console.log('Items count:', verifyResult.items ? verifyResult.items.length : 0);
    
    if (verifyResult.items && verifyResult.items.length > 0) {
      const firstItem = verifyResult.items[0];
      console.log('First item penalty fields:');
      console.log('  - Penalty %:', firstItem.penalty_percentage);
      console.log('  - Penalty Amount:', firstItem.penalty_amount);
      console.log('  - Balance Quantity Undelivered:', firstItem.balance_quantity_undelivered);
      console.log('  - Lead Time:', firstItem.lead_time);
      console.log('  - Due Date:', firstItem.due_date);
      
      // Check if values were saved
      if (firstItem.penalty_percentage === '5.0' && 
          firstItem.penalty_amount === '127.50' && 
          firstItem.balance_quantity_undelivered === '10' &&
          firstItem.lead_time === '7 days') {
        console.log('\n🎉 SUCCESS! All penalty fields were saved correctly!');
      } else {
        console.log('\n❌ FAILED! Penalty fields were not saved correctly.');
      }
    } else {
      console.log('❌ No items found in the PO');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testPurchaseOrderUpdateFix();
