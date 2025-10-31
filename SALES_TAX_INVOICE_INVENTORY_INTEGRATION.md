# Sales Tax Invoice - Inventory Integration

## Overview
The Sales Tax Invoice creation endpoint now automatically validates inventory availability and updates stock levels when invoices are created. This ensures real-time inventory tracking and prevents overselling.

## API Endpoint
**POST** `http://localhost:8000/api/sales-tax-invoices`

## Key Features

### ✅ 1. Pre-Invoice Validation
Before creating the invoice, the system validates ALL items:
- **Inventory Existence**: Item must exist (by `part_no` + `material_no`)
- **Stock Availability**: Balance must be > 0
- **Sufficient Quantity**: Requested quantity ≤ available balance

**If ANY validation fails → Invoice is NOT created**

### ✅ 2. Automatic Inventory Updates
For each sold item:
```javascript
- Increase sold_quantity by sale quantity
- Decrease balance (balance = quantity - sold_quantity)
- Recalculate balance_amount = balance × supplier_unit_price
- Keep total_price = quantity × supplier_unit_price
- Auto-update updated_at timestamp
```

### ✅ 3. Transaction Support
```javascript
BEGIN TRANSACTION
├─ Validate all items
├─ If validation fails: ROLLBACK & return errors
├─ Create sales invoice
├─ Insert invoice items
├─ Update inventory for each item
└─ COMMIT (success) or ROLLBACK (error)
FINALLY: Release connection
```

### ✅ 4. Comprehensive Error Reporting
Returns detailed validation errors with:
- Item index in the list
- Part number and material number
- Requested vs. available quantities
- Specific error messages

## Implementation Details

### Updated File
**`backend/routes/salesTaxInvoices.js`** - POST endpoint

### Process Flow

```
1. Start Transaction
   └─ Get database connection

2. Validate Customer & Claim Percentage
   ├─ Check customer exists
   └─ Validate claim % for PO

3. Inventory Validation (BEFORE creating invoice)
   For each item:
   ├─ Check part_no + material_no provided
   ├─ Check item exists in inventory
   ├─ Check balance > 0
   └─ Check requested_qty <= available_balance
   
   If ANY fails:
   ├─ ROLLBACK transaction
   └─ Return 400 with detailed errors

4. Create Invoice (Only if validation passes)
   ├─ Generate invoice number
   ├─ Calculate totals
   └─ INSERT sales_tax_invoices

5. Add Items & Update Inventory
   For each item:
   ├─ INSERT sales_tax_invoice_items
   └─ UPDATE inventory:
      ├─ sold_quantity += sale_quantity
      ├─ balance = quantity - sold_quantity
      ├─ balance_amount = balance × unit_price
      └─ updated_at = NOW()

6. Commit Transaction
   └─ Return success with invoice number

7. Error Handling
   ├─ ROLLBACK on any error
   └─ Release connection
```

## Request Example

```json
{
  "customer_id": "CUST001",
  "invoice_date": "2025-01-15",
  "customer_po_number": "PO-2025-001",
  "customer_po_date": "2025-01-10",
  "payment_terms": "Net 30",
  "contract_number": "CNT-2025-001",
  "delivery_terms": "FOB",
  "claim_percentage": 100,
  "items": [
    {
      "part_no": "PART-001",
      "material_no": "MAT-001",
      "description": "Widget A",
      "quantity": 50,
      "unit_price": 25.50
    },
    {
      "part_no": "PART-002",
      "material_no": "MAT-002",
      "description": "Widget B",
      "quantity": 30,
      "unit_price": 45.00
    }
  ]
}
```

## Response Examples

### Success Response
```json
{
  "message": "Sales tax invoice created successfully and inventory updated",
  "id": 1,
  "invoice_number": "AT-INV-2025-001"
}
```

### Validation Error Response (Insufficient Stock)
```json
{
  "message": "Inventory validation failed. Cannot create sales invoice.",
  "validation_errors": [
    {
      "item_index": 1,
      "part_no": "PART-001",
      "material_no": "MAT-001",
      "requested_quantity": 150,
      "available_balance": 100,
      "error": "Insufficient stock. Requested: 150, Available: 100"
    }
  ]
}
```

### Validation Error Response (Item Not Found)
```json
{
  "message": "Inventory validation failed. Cannot create sales invoice.",
  "validation_errors": [
    {
      "item_index": 2,
      "part_no": "PART-999",
      "material_no": "MAT-999",
      "requested_quantity": 50,
      "error": "Item not found in inventory"
    }
  ]
}
```

### Validation Error Response (No Stock)
```json
{
  "message": "Inventory validation failed. Cannot create sales invoice.",
  "validation_errors": [
    {
      "item_index": 1,
      "part_no": "PART-001",
      "material_no": "MAT-001",
      "requested_quantity": 10,
      "available_balance": 0,
      "error": "No stock available (balance is 0 or negative)"
    }
  ]
}
```

## Console Logging

The process provides detailed console logs:

```bash
✓ Inventory updated: part_no=PART-001, material_no=MAT-001, sold_quantity: 0 + 50 = 50, new_balance=50
✓ Inventory updated: part_no=PART-002, material_no=MAT-002, sold_quantity: 10 + 30 = 40, new_balance=10
✓ Sales invoice created and inventory updated successfully
```

## Testing Scenarios

### Scenario 1: Successful Sale
**Given:**
- Inventory has PART-001 with balance=100
- Sales invoice requests quantity=50

**Expected:**
- Invoice created successfully
- Inventory updated:
  - sold_quantity: 0 → 50
  - balance: 100 → 50
  - balance_amount recalculated

### Scenario 2: Insufficient Stock
**Given:**
- Inventory has PART-001 with balance=30
- Sales invoice requests quantity=50

**Expected:**
- Invoice NOT created
- Error returned: "Insufficient stock. Requested: 50, Available: 30"
- No inventory changes

### Scenario 3: Item Not in Inventory
**Given:**
- Sales invoice includes PART-999 which doesn't exist

**Expected:**
- Invoice NOT created
- Error returned: "Item not found in inventory"
- No changes to database

### Scenario 4: Zero Balance
**Given:**
- Inventory has PART-001 with balance=0
- Sales invoice requests quantity=10

**Expected:**
- Invoice NOT created
- Error returned: "No stock available (balance is 0 or negative)"

### Scenario 5: Multiple Items, One Fails
**Given:**
- Invoice has 3 items
- Item 1: Available (balance=100)
- Item 2: Insufficient stock (balance=5, requested=10)
- Item 3: Available (balance=50)

**Expected:**
- Invoice NOT created
- Error for Item 2 returned
- NO inventory changes (transaction rolled back)

### Scenario 6: Transaction Rollback
**Given:**
- Invoice validation passes
- Database error occurs during inventory update

**Expected:**
- Transaction rolled back
- Invoice NOT created
- No inventory changes
- Error message returned

## Inventory Calculations

### Before Sale:
```
quantity = 100
sold_quantity = 0
balance = 100
supplier_unit_price = 25.50
balance_amount = 100 × 25.50 = 2,550.00
total_price = 100 × 25.50 = 2,550.00
```

### After Selling 50 Units:
```
quantity = 100 (unchanged)
sold_quantity = 50 (0 + 50)
balance = 50 (100 - 50)
supplier_unit_price = 25.50 (unchanged)
balance_amount = 50 × 25.50 = 1,275.00
total_price = 100 × 25.50 = 2,550.00 (unchanged)
```

## Benefits

✅ **Prevents Overselling**: Validates stock before creating invoice  
✅ **Real-Time Updates**: Inventory reflects sales immediately  
✅ **Data Integrity**: Transaction ensures all-or-nothing  
✅ **Accurate Tracking**: sold_quantity and balance always consistent  
✅ **Detailed Errors**: Know exactly what went wrong  
✅ **Audit Trail**: Console logs track all operations  
✅ **Business Protection**: Cannot sell what you don't have  

## Important Notes

1. **Unique Identification**: Items matched by `part_no` + `material_no`
2. **Validation First**: ALL items validated BEFORE invoice creation
3. **Atomic Operation**: Either all succeed or all fail (no partial updates)
4. **Balance Formula**: balance = quantity - sold_quantity
5. **Price Preservation**: total_price based on original quantity purchased
6. **Balance Amount**: balance_amount = current balance × unit price
7. **Timestamp**: updated_at automatically set on inventory update

## Integration with Purchase Tax Invoices

This creates a complete inventory cycle:

**Purchase Tax Invoice (Supplier Invoice):**
- ✅ Adds to inventory (increases quantity)
- ✅ Increases balance

**Sales Tax Invoice (Customer Invoice):**
- ✅ Validates availability
- ✅ Reduces balance (increases sold_quantity)
- ✅ Prevents overselling

**Complete Flow:**
```
1. Purchase: Buy 100 units
   → quantity=100, balance=100

2. Sell: Sell 50 units
   → sold_quantity=50, balance=50

3. Purchase: Buy 30 more units
   → quantity=130, balance=80 (130-50)

4. Sell: Try to sell 100 units
   → ERROR: Only 80 available

5. Sell: Sell 80 units
   → sold_quantity=130, balance=0
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "Item not found in inventory" | Item never purchased | Purchase item first via Purchase Tax Invoice |
| "Insufficient stock" | Trying to sell more than available | Check inventory balance, adjust quantity |
| "No stock available" | Balance is 0 | Purchase more stock |
| Transaction timeout | Large invoice with many items | Increase connection timeout |
| Validation passes but update fails | Database constraint issue | Check database integrity |

## Frontend Integration Tips

1. **Check Stock Before Creating Invoice:**
```javascript
// Optional: Query inventory availability before submitting
const checkStock = async (part_no, material_no) => {
  const response = await api.get(`/inventory?part_no=${part_no}&material_no=${material_no}`);
  return response.data.balance;
};
```

2. **Handle Validation Errors:**
```javascript
try {
  const response = await salesTaxInvoicesAPI.create(invoiceData);
  // Success
} catch (error) {
  if (error.response?.data?.validation_errors) {
    // Show specific errors for each item
    error.response.data.validation_errors.forEach(err => {
      console.error(`Item ${err.item_index}: ${err.error}`);
    });
  }
}
```

3. **Display Available Stock:**
```javascript
// Show available balance when selecting items
<input 
  type="number" 
  max={item.available_balance}
  placeholder={`Max: ${item.available_balance}`}
/>
```

## Performance Considerations

- **Validation Speed**: Each item requires one SELECT query
- **Large Invoices**: 100 items = ~100 validation queries + updates
- **Transaction Time**: Held during entire process
- **Connection Pool**: Uses one connection per invoice creation
- **Optimization**: Validation queries are indexed by part_no + material_no

## Future Enhancements (Optional)

- [ ] Add inventory reservation system (hold stock for pending invoices)
- [ ] Implement backordering for insufficient stock
- [ ] Add low stock warnings
- [ ] Create inventory movement history table
- [ ] Support partial fulfillment (split invoices)
- [ ] Add real-time stock availability API
- [ ] Implement warehouse/location-based stock tracking

---

**Status:** ✅ **Fully Implemented**  
**Last Updated:** 2025-01-17  
**Version:** 1.0  
**Breaking Changes:** None  
**Dependencies:** Requires inventory table with part_no + material_no


