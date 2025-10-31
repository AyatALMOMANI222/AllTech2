# Delivered Data Calculation Implementation Guide

## Overview
This document outlines the comprehensive implementation for calculating and displaying delivered purchase order data based on invoice data.

## Requirements Summary

### 1. Invoice Types
- **Sales Tax Invoice** (Customer Invoice) → related to Customer Purchase Orders
- **Purchase Tax Invoice** (Supplier Invoice) → related to Supplier Purchase Orders

### 2. Data Source Structure
**Customer Invoices:** `items[].quantity`, `items[].unit_price`, `items[].total_amount`  
**Supplier Invoices:** `items[].quantity`, `items[].supplier_unit_price`, `items[].total_price`

### 3. Calculations (per item)
All calculations must be done **per item**, aggregating across **all related invoices**.

- **DELIVERED QUANTITY** → sum of all quantities per item across all related invoices
- **DELIVERED UNIT PRICE** → take from any related invoice (same for all items)
- **DELIVERED TOTAL PRICE** → DELIVERED QUANTITY × DELIVERED UNIT PRICE

### 4. Penalty and Balance
- **PENALTY %** → if value exists, use it; if not, leave empty
- **PENALTY AMOUNT** → if PENALTY % exists: (PENALTY % × DELIVERED TOTAL PRICE) / 100
- **BALANCE QUANTITY UNDELIVERED** → ORDERED QUANTITY (from APPROVED) - DELIVERED QUANTITY

### 5. Display Conditions
Show all information in **DELIVERED PURCHASED ORDER** section only when Purchase Order status is **"delivered"** (partially or completely).

## Implementation Status

### ✅ Completed
1. Created API endpoint: `POST /api/database-dashboard/calculate-delivered/:po_id`
   - Fetches PO type (customer or supplier)
   - Gets all items for the PO
   - For each item:
     - Fetches related invoices based on PO type
     - Sums quantities across all invoices
     - Gets unit price from any invoice
     - Calculates delivered_total_price
     - Gets/keeps penalty_percentage
     - Calculates penalty_amount
     - Calculates balance_quantity_undelivered
     - Updates purchase_order_items table

### ⚠️ Remaining Work

#### 1. Trigger Calculation Automatically
Add calls to calculate delivered data when:
- Sales Tax Invoice is created/updated/deleted
- Purchase Tax Invoice is created/updated/deleted

**Location:** `backend/routes/salesTaxInvoices.js` and `backend/routes/purchaseTaxInvoices.js`

**Implementation:**
```javascript
// After creating/updating invoice, find related PO and recalculate
if (po_number) {
  const [pos] = await req.db.execute(
    'SELECT id FROM purchase_orders WHERE po_number = ?',
    [po_number]
  );
  
  if (pos.length > 0) {
    // Call calculation endpoint via HTTP or directly
    const po_id = pos[0].id;
    // Trigger recalculation...
  }
}
```

#### 2. Update Dashboard Query
The current dashboard query fetches delivered data from `purchase_order_items` table. This is correct IF the items have been calculated.

**Current Behavior:**
- Fetches from `purchase_order_items.delivered_quantity`, etc.
- Shows only when `po.status IN ('partially_delivered', 'delivered_completed')`

**Enhancement Needed:**
- Auto-trigger calculation when displaying dashboard if data is missing
- Or, add a background job to recalculate all delivered POs

#### 3. Status Management
Update Purchase Order status automatically based on delivered quantities:
- When delivered_quantity = 0 → keep as 'approved'
- When 0 < delivered_quantity < quantity → status = 'partially_delivered'
- When delivered_quantity >= quantity → status = 'delivered_completed'

**Location:** `backend/routes/purchaseOrders.js` or create a trigger/function

## Database Schema

### purchase_order_items Table
Already has the required columns:
```sql
quantity DECIMAL(10,2)                          -- Ordered quantity
delivered_quantity DECIMAL(10,2)                -- Sum from invoices
delivered_unit_price DECIMAL(10,2)             -- From invoices
delivered_total_price DECIMAL(12,2)            -- Calculated
penalty_percentage DECIMAL(5,2)                -- User input
penalty_amount DECIMAL(12,2)                   -- Calculated
balance_quantity_undelivered DECIMAL(10,2)     -- Calculated
invoice_no VARCHAR(100)                        -- Concatenated invoice numbers
```

## API Usage

### Manual Recalculation
```bash
POST http://localhost:8000/api/database-dashboard/calculate-delivered/:po_id
```

### Response
```json
{
  "success": true,
  "message": "Delivered data calculated and updated successfully",
  "po_id": 123
}
```

## Workflow

### When Invoices Are Created/Updated:
1. User creates Sales or Purchase Tax Invoice
2. Invoice has `po_number` linking to a Purchase Order
3. System automatically:
   - Finds related PO
   - For each item in PO:
     - Finds all invoices for that PO
     - Sums quantities per item (matching by part_no and material_no)
     - Stores calculated values in `purchase_order_items`
   - Updates PO status based on delivery completion

### When Dashboard Is Displayed:
1. User views Database Dashboard
2. System fetches inventory items
3. For each item, shows:
   - Approved Orders (status = 'approved')
   - Delivered Orders (status IN ('partially_delivered', 'delivered_completed'))
4. Delivered data comes from pre-calculated values in `purchase_order_items`

## Testing Checklist

- [ ] Create Customer PO
- [ ] Create Sales Tax Invoice linked to the PO
- [ ] Verify delivered quantities are calculated
- [ ] Create multiple invoices for same PO
- [ ] Verify quantities are summed correctly
- [ ] Update penalty percentage in PO
- [ ] Verify penalty_amount is recalculated
- [ ] Check DELIVERED section in Database Dashboard
- [ ] Test with Supplier PO and Purchase Tax Invoice
- [ ] Test partial delivery scenarios
- [ ] Test automatic status updates

## Priority Actions

1. **HIGH:** Add automatic calculation triggers in invoice routes
2. **HIGH:** Update dashboard to show calculated data
3. **MEDIUM:** Add status auto-update logic
4. **LOW:** Add recalculation background job for existing data

## Notes

- The calculation endpoint is ready to use
- Data must be triggered to calculate (not automatic yet)
- Display logic in dashboard is ready
- Need to connect invoice events to calculation trigger

