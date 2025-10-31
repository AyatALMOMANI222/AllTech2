# Purchase Tax Invoice - Inventory Integration

## Overview
The Purchase Tax Invoice creation endpoint now automatically updates the inventory table whenever a new invoice is created. This ensures real-time inventory tracking based on purchase transactions.

## Implementation Details

### API Endpoint
**POST** `http://localhost:8000/api/purchase-tax-invoices`

### Key Features

#### ✅ 1. Transaction Support
- All database operations are wrapped in a **MySQL transaction**
- If any operation fails, the entire transaction is **rolled back**
- Ensures data consistency across invoice and inventory tables

#### ✅ 2. Smart Inventory Management
For each item in the Purchase Tax Invoice:

**If item DOES NOT exist in inventory:**
- Checks based on: `part_no` **AND** `material_no`
- **Inserts** a new inventory record with:
  - `serial_no`, `project_no`, `part_no`, `material_no`, `description`, `uom`
  - `date_po` = invoice date
  - `quantity` = purchased quantity
  - `supplier_unit_price` = from invoice
  - `total_price` = quantity × supplier_unit_price
  - `sold_quantity` = 0 (initial)
  - `balance` = quantity
  - `balance_amount` = balance × supplier_unit_price

**If item ALREADY exists in inventory:**
- **Updates** the existing record:
  - `quantity` = existing quantity + new purchased quantity
  - `supplier_unit_price` = latest unit price from invoice
  - `total_price` = updated quantity × supplier_unit_price
  - `balance` = updated quantity - sold_quantity
  - `balance_amount` = balance × supplier_unit_price
  - `updated_at` = automatically refreshed

#### ✅ 3. Automatic Calculations
- All monetary calculations are handled automatically
- Balance is recalculated considering existing sold quantities
- Ensures accurate inventory valuation

#### ✅ 4. Error Handling
- Validates all required fields before processing
- Comprehensive error logging
- Returns detailed error messages
- Transaction rollback on any failure

## Code Changes

### 1. Updated: `backend/routes/purchaseTaxInvoices.js`

**Key Changes:**
```javascript
// POST /api/purchase-tax-invoices
- Added database connection from pool
- Wrapped all operations in transaction (BEGIN/COMMIT/ROLLBACK)
- Added inventory existence check based on part_no AND material_no
- Implemented INSERT logic for new inventory items
- Implemented UPDATE logic for existing inventory items
- Added automatic balance and amount recalculation
- Proper connection release in finally block
```

**Transaction Flow:**
1. Begin Transaction
2. Insert Purchase Tax Invoice
3. Insert Invoice Items
4. For each item:
   - Check if exists in inventory (part_no + material_no)
   - If not exists: INSERT new inventory record
   - If exists: UPDATE quantities and recalculate
5. Commit Transaction (success) OR Rollback (error)
6. Release database connection

### 2. Updated: `backend/initDb.js`

**Added Tables:**
```sql
-- Purchase Tax Invoices table
CREATE TABLE purchase_tax_invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  invoice_date DATE NOT NULL,
  supplier_id VARCHAR(50) NOT NULL,
  po_number VARCHAR(100),
  project_number VARCHAR(100),
  claim_percentage DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  vat_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  gross_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status ENUM('draft', 'received', 'paid', 'cancelled') DEFAULT 'draft',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES customers_suppliers(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Purchase Tax Invoice Items table
CREATE TABLE purchase_tax_invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  serial_no VARCHAR(100),
  project_no VARCHAR(100),
  part_no VARCHAR(100),
  material_no VARCHAR(100),
  description TEXT,
  uom VARCHAR(50),
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  supplier_unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES purchase_tax_invoices(id) ON DELETE CASCADE
);
```

## Usage Example

### Request Body
```json
{
  "invoice_number": "PTI-2025-001",
  "invoice_date": "2025-01-15",
  "supplier_id": "SUP001",
  "po_number": "PO-2025-001",
  "project_number": "PROJ-123",
  "claim_percentage": 100,
  "items": [
    {
      "serial_no": "1",
      "project_no": "PROJ-123",
      "part_no": "PART-001",
      "material_no": "MAT-001",
      "description": "Widget A",
      "uom": "PCS",
      "quantity": 100,
      "supplier_unit_price": 25.50
    },
    {
      "serial_no": "2",
      "project_no": "PROJ-123",
      "part_no": "PART-002",
      "material_no": "MAT-002",
      "description": "Widget B",
      "uom": "PCS",
      "quantity": 50,
      "supplier_unit_price": 45.00
    }
  ]
}
```

### Success Response
```json
{
  "message": "Purchase tax invoice created successfully and inventory updated",
  "id": 1,
  "invoice_number": "PTI-2025-001"
}
```

### Error Response
```json
{
  "message": "Error creating purchase tax invoice",
  "error": "Detailed error message"
}
```

## Database Migration

If you have an existing database, run:

```bash
cd backend
node initDb.js
```

This will create the necessary tables without affecting existing data.

## Testing Scenarios

### Scenario 1: New Inventory Item
**Given:** Item with part_no="PART-001" and material_no="MAT-001" doesn't exist  
**When:** Purchase Tax Invoice is created with this item  
**Then:** 
- New inventory record is inserted
- quantity = 100
- balance = 100
- sold_quantity = 0
- Properly calculated amounts

### Scenario 2: Existing Inventory Item
**Given:** Item with part_no="PART-001" and material_no="MAT-001" exists with quantity=50  
**When:** Purchase Tax Invoice is created with quantity=30 of same item  
**Then:** 
- Existing inventory record is updated
- New quantity = 50 + 30 = 80
- balance = 80 - sold_quantity
- Amounts recalculated

### Scenario 3: Transaction Rollback
**Given:** Invoice has 5 items  
**When:** 4th item fails to insert/update  
**Then:** 
- Entire transaction is rolled back
- Invoice not created
- No inventory changes
- Error message returned

## Benefits

✅ **Data Integrity:** Transaction ensures all-or-nothing operation  
✅ **Automatic Tracking:** Inventory updated in real-time  
✅ **Accurate Balances:** Proper calculation of stock levels  
✅ **No Manual Entry:** Eliminates duplicate data entry  
✅ **Audit Trail:** Timestamps track all changes  
✅ **Error Safety:** Rollback prevents partial updates  
✅ **Scalable:** Works with any number of invoice items  

## Important Notes

1. **Unique Identification:** Items are matched by **both** `part_no` AND `material_no`
2. **Date Tracking:** `date_po` in inventory is set to the invoice date
3. **Price Updates:** Latest supplier unit price is always used
4. **Balance Calculation:** Automatically considers sold quantities
5. **Connection Pool:** Uses MySQL connection pool for efficiency
6. **Logging:** Console logs track inventory operations for debugging

## Troubleshooting

**Issue:** Transaction timeout  
**Solution:** Increase connection pool timeout in `server.js`

**Issue:** Foreign key constraint fails  
**Solution:** Ensure supplier exists in `customers_suppliers` table

**Issue:** Duplicate part_no/material_no  
**Solution:** System handles updates automatically - no action needed

## Future Enhancements (Optional)

- Add inventory history tracking table
- Implement batch processing for large invoices
- Add email notifications on inventory updates
- Create inventory level alerts
- Generate purchase reports

---

**Last Updated:** 2025-01-17  
**Version:** 1.0  
**Status:** ✅ Fully Implemented and Tested


