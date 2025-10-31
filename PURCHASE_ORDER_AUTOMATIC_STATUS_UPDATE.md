# Purchase Order Automatic Status Update

## Overview
Implemented automatic status updates for customer purchase orders based on invoiced quantities. When a Sales Tax Invoice is created, the system automatically updates the associated purchase order status to reflect delivery progress.

## Status Values

### Updated ENUM
The `purchase_orders.status` column now has three possible values:

| Status | Description | Condition |
|--------|-------------|-----------|
| `approved` | Initial status, no items invoiced | Total invoiced = 0 |
| `partially_delivered` | Some items invoiced, others pending | Total invoiced > 0 AND < Total ordered |
| `delivered_completed` | All items fully invoiced | Total invoiced = Total ordered |

## Implementation

### 1. Database Schema Update
**File:** `backend/initDb.js`

Updated the `purchase_orders` table:
```sql
status ENUM('approved', 'partially_delivered', 'delivered_completed') DEFAULT 'approved'
```

### 2. Migration Script
**File:** `backend/migrations/update_purchase_order_status_enum.js`

Migration to update existing database:
```bash
node migrations/update_purchase_order_status_enum.js
```

✅ **Migration completed successfully**

### 3. Automatic Status Update Function
**File:** `backend/routes/salesTaxInvoices.js` (Lines 5-106)

New function: `updatePurchaseOrderStatus(connection, customerPoNumber)`

**Logic:**
1. Fetches the purchase order by `customer_po_number`
2. Gets all PO items with their ordered quantities
3. Calculates total invoiced quantity from `sales_tax_invoice_items`
4. Compares totals to determine status
5. Updates PO status if changed

**Status Determination:**
```javascript
if (totalInvoiced === 0) {
  status = 'approved';
} else if (totalInvoiced === totalOrdered) {
  status = 'delivered_completed';
} else if (totalInvoiced > 0 && totalInvoiced < totalOrdered) {
  status = 'partially_delivered';
}
```

### 4. Integration with Sales Tax Invoice Creation
**File:** `backend/routes/salesTaxInvoices.js` (Lines 508-511)

Called automatically after invoice creation:
```javascript
// STEP 4: Update purchase order status based on invoiced quantities
if (customer_po_number) {
  await updatePurchaseOrderStatus(connection, customer_po_number);
}
```

### 5. Updated API Endpoint
**File:** `backend/routes/salesTaxInvoices.js` (Line 664)

GET endpoint now returns all valid statuses:
```javascript
AND po.status IN ('approved', 'partially_delivered', 'delivered_completed')
```

## How It Works

### Example Flow

**1. Initial State - Approved**
- Customer creates PO with 100 units ordered
- Total invoiced: 0
- Status: `approved`

**2. Partial Delivery - Partially Delivered**
- First Sales Tax Invoice created for 40 units
- Total invoiced: 40
- Total ordered: 100
- Status: `partially_delivered` ✅

**3. Another Partial Delivery**
- Second Sales Tax Invoice created for 35 units
- Total invoiced: 75
- Total ordered: 100
- Status: `partially_delivered` ✅

**4. Complete Delivery - Delivered Completed**
- Third Sales Tax Invoice created for 25 units
- Total invoiced: 100
- Total ordered: 100
- Status: `delivered_completed` ✅

## Matching Logic

The system matches invoice items to PO items using:
- `customer_po_number` (links invoice to PO)
- `project_no` (matches specific project)
- `part_no` (matches part number)
- `description` (matches item description)

## Console Output

When status is updated, you'll see:
```
✓ PO PO-2025-001 status updated: approved → partially_delivered
  Total ordered: 100, Total invoiced: 40
```

When status unchanged:
```
  PO PO-2025-001 status unchanged: partially_delivered
  Total ordered: 100, Total invoiced: 40
```

## API Usage

### Creating a Sales Tax Invoice
```json
POST /api/sales-tax-invoices
{
  "customer_id": "CUST001",
  "customer_po_number": "PO-2025-001",
  "invoice_date": "2025-01-17",
  "claim_percentage": 100,
  "items": [
    {
      "project_no": "P002",
      "part_no": "PN002",
      "description": "Hammer",
      "quantity": 10,
      "unit_price": 15.00
    }
  ]
}
```

**What happens:**
1. Invoice is created
2. Inventory is updated
3. **PO status is automatically updated** ✨
4. Transaction commits

### Querying Purchase Orders

```sql
SELECT po_number, status, updated_at
FROM purchase_orders
WHERE order_type = 'customer'
ORDER BY status, updated_at DESC;
```

## Important Notes

1. **Status updates are automatic** - No manual intervention needed
2. **Non-blocking** - If PO update fails, invoice creation continues
3. **Transaction-safe** - Updates happen within the same transaction
4. **Case-insensitive** - Status values use underscore_case
5. **Cancelled invoices excluded** - Only non-cancelled invoices count
6. **Aggregated quantities** - Multiple invoices for same PO are summed

## Edge Cases Handled

### No PO Found
```
Purchase order PO-2025-001 not found
```
Status update skipped, invoice still created.

### No PO Items
```
No items found in purchase order PO-2025-001
```
Status remains unchanged.

### PO Update Error
Errors are logged but don't block invoice creation.

## Benefits

✅ **Real-time tracking** - Know exactly how much has been invoiced  
✅ **Automatic updates** - No manual status changes needed  
✅ **Visual progress** - Clear status indicators for each PO  
✅ **Order management** - Easy to identify pending orders  
✅ **Audit trail** - Status changes logged with timestamps  

## Testing

### Test Scenario 1: New PO with First Invoice
```
1. Create customer PO for 50 units
   → Status: approved

2. Create sales invoice for 50 units
   → Status: delivered_completed ✅
```

### Test Scenario 2: Partial Delivery
```
1. Create customer PO for 100 units
   → Status: approved

2. Create sales invoice for 60 units
   → Status: partially_delivered ✅

3. Create sales invoice for 40 units
   → Status: delivered_completed ✅
```

### Test Scenario 3: Multiple Partial Invoices
```
1. Create customer PO for 100 units
   → Status: approved

2. Create sales invoice for 30 units
   → Status: partially_delivered ✅

3. Create sales invoice for 30 units
   → Status: partially_delivered ✅

4. Create sales invoice for 40 units
   → Status: delivered_completed ✅
```

## Database Schema

```sql
CREATE TABLE purchase_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_number VARCHAR(100) UNIQUE NOT NULL,
  order_type ENUM('customer', 'supplier') NOT NULL,
  customer_supplier_id VARCHAR(50),
  customer_supplier_name VARCHAR(255),
  status ENUM('approved', 'partially_delivered', 'delivered_completed') DEFAULT 'approved',
  total_amount DECIMAL(10,2) DEFAULT 0.0,
  created_by INT,
  approved_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_supplier_id) REFERENCES customers_suppliers(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
);
```

## Files Changed

| File | Changes |
|------|---------|
| `backend/initDb.js` | Updated status ENUM |
| `backend/routes/salesTaxInvoices.js` | Added `updatePurchaseOrderStatus()` function and integrated into invoice creation |
| `backend/migrations/update_purchase_order_status_enum.js` | Created migration script |

---

**Status:** ✅ **Implemented**  
**Last Updated:** 2025-01-17  
**Version:** 1.0  
**Breaking Changes:** Yes - Status values changed from 'delivered' to 'delivered_completed'  
**Migration Required:** Yes - Run `backend/migrations/update_purchase_order_status_enum.js`



