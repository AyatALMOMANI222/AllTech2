const fs = require('fs');
const path = require('path');

// Test the import API
async function testImport() {
  try {
    const csvContent = `serial_no,project_no,date_po,part_no,material_no,description,uom,quantity,supplier_unit_price,total_price,sold_quantity,balance,balance_amount
INV001,PRJ001,2024-01-15,PART001,MAT001,Steel Rod 10mm,pcs,100,25.50,2550.00,20,80,2040.00
INV002,PRJ002,2024-01-16,PART002,MAT002,Aluminum Sheet 2mm,sqft,50,45.00,2250.00,10,40,1800.00`;

    // Create a test CSV file
    const testFile = 'test_inventory.csv';
    fs.writeFileSync(testFile, csvContent);
    
    console.log('Test CSV file created:', testFile);
    console.log('You can now test the import functionality in the frontend.');
    console.log('Navigate to http://localhost:3000/inventory and use the "Import Excel" button.');
    console.log('Select the test_inventory.csv file to test the import.');
    
  } catch (error) {
    console.error('Error creating test file:', error);
  }
}

testImport();

