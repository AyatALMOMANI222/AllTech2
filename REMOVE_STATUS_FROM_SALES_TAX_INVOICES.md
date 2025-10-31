# Remove Status Column from sales_tax_invoices Table

## Overview
Removed the `status` column completely from the `sales_tax_invoices` table and all related code. The system now relies solely on the `purchase_orders` table for tracking and updating order statuses.

## Changes Made

### 1. Database Schema (initDb.js)
**File:** `backend/initDb.js`

**Removed:**
```sql
status ENUM('draft', 'sent', 'paid', 'cancelled') DEFAULT 'draft',
```

**Final Structure:**
```sql
CREATE TABLE IF NOT EXISTS sales_tax_invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  invoice_date DATE NOT NULL,
  customer_id VARCHAR(50) NOT NULL,
  customer_po_number VARCHAR(100),
  customer_po_date DATE,
  payment_terms TEXT,
  contract_number VARCHAR(255),
  delivery_terms VARCHAR(100),
  claim_percentage DECIMAL(5,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  claim_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  vat_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  gross_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  amount_in_words TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ...
);
```

### 2. API Endpoint Updates
**File:** `backend/routes/salesTaxInvoices.js`

#### GET /api/sales-tax-invoices
- **Removed:** `status` query parameter
- **Removed:** `sti.status = ?` filter condition

**Before:**
```javascript
const { page = 1, limit = 50, status, customer_id, customer_po_number } = req.query;

if (status) {
  conditions.push('sti.status = ?');
  params.push(status);
}
```

**After:**
```javascript
const { page = 1, limit = 50, customer_id, customer_po_number } = req.query;
```

#### POST /api/sales-tax-invoices
- **Removed:** Status validation checks in claim percentage queries
- **Removed:** `status != 'cancelled'` conditions

**Before:**
```javascript
WHERE customer_po_number = ? AND status != 'cancelled'
```

**After:**
```javascript
WHERE customer_po_number = ?
```

#### PUT /api/sales-tax-invoices/:id
- **Removed:** Status validation checks in claim percentage queries
- **Removed:** `status != 'cancelled'` conditions

**Before:**
```javascript
WHERE customer_po_number = ? AND status != 'cancelled' AND id != ?
```

**After:**
```javascript
WHERE customer_po_number = ? AND id != ?
```

### 3. Database Migration
**File:** `backend/migrations/remove_status_from_sales_tax_invoices.js`

Migration script executed successfully:
- ✅ Dropped `status` column from `sales_tax_invoices` table
- ✅ Verified column removal

## New Status Management

### Purchase Orders Table
The system now relies entirely on `purchase_orders.status` for order tracking:

| Status | Description |
|--------|-------------|
| `approved` | Order approved, no items invoiced yet |
| `delivered` | Order fully delivered/invoiced |

**Note:** Status is automatically updated in the `purchase_orders` table when Sales Tax Invoices are created.

## Impact Analysis

### ✅ No Breaking Changes for Frontend

The frontend can continue to work as-is since the status column was never exposed in API responses (it was only used internally for filtering and validation).

### Files Modified

| File | Changes |
|------|---------|
| `backend/initDb.js` | Removed status column from CREATE TABLE |
| `backend/routes/salesTaxInvoices.js` | Removed status query parameter and filters |
| `backend/migrations/remove_status_from_sales_tax_invoices.js` | Created and executed migration |

### Features Removed

1. ❌ Status filtering in GET endpoint
2. ❌ Status-based validation in POST endpoint
3. ❌ Status-based validation in PUT endpoint
4. ❌ Status tracking for individual invoices

### Features Preserved

1. ✅ Claim percentage validation
2. ✅ Inventory updates
3. ✅ Invoice creation
4. ✅ Purchase order status updates (separate system)

## Benefits

✅ **Simplified Schema** - Fewer columns to maintain  
✅ **Single Source of Truth** - Status only in purchase_orders table  
✅ **Reduced Complexity** - No need to track invoice status separately  
✅ **Clearer Logic** - Purchase orders track delivery status automatically  

## Database Verification

After migration, the `sales_tax_invoices` table has these columns:
- id
- invoice_number
- invoice_date
- customer_id
- customer_po_number
- customer_po_date
- payment_terms
- contract_number
- delivery_terms
- claim_percentage
- subtotal
- claim_amount
- vat_amount
- gross_total
- amount_in_words
- created_by
- created_at
- updated_at

## Important Notes

1. **Status tracking is now centralized** in the `purchase_orders` table
2. **Sales tax invoices are now stateless** - they're just records of completed sales
3. **No manual status management** needed for individual invoices
4. **Purchase order status** is automatically updated based on invoiced quantities

## Migration Summary

```sql
-- This SQL was executed by the migration script
ALTER TABLE sales_tax_invoices DROP COLUMN status;
```

✅ **Migration completed successfully**

---

**Status:** ✅ **Completed**  
**Last Updated:** 2025-01-17  
**Breaking Changes:** No API breaking changes  
**Database Changes:** Yes - Column dropped  
**Migration Required:** Already executed


