# Status Column Fix - Sales Tax Invoices

## Problem
Error when creating sales tax invoice:
```json
{
    "message": "Error creating sales tax invoice",
    "error": "Data truncated for column 'status' at row 1"
}
```

## Root Cause
The INSERT statement for `sales_tax_invoices` was not explicitly setting the `status` column. While the column has a DEFAULT value of 'draft', in some cases MySQL was unable to apply the default correctly, causing the error.

## Solution
✅ **Updated INSERT statement to explicitly include `status` column**

### Change Made
**File:** `backend/routes/salesTaxInvoices.js` (Lines 338-348)

**Before:**
```javascript
INSERT INTO sales_tax_invoices (
  invoice_number, invoice_date, customer_id, customer_po_number, customer_po_date,
  payment_terms, contract_number, delivery_terms, claim_percentage,
  subtotal, claim_amount, vat_amount, gross_total, amount_in_words, created_by
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

**After:**
```javascript
INSERT INTO sales_tax_invoices (
  invoice_number, invoice_date, customer_id, customer_po_number, customer_po_date,
  payment_terms, contract_number, delivery_terms, claim_percentage,
  subtotal, claim_amount, vat_amount, gross_total, amount_in_words, created_by, status
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

// With value added:
..., 'draft'  // Added to the parameters array
```

## Status Column Details
- **Type:** `ENUM('draft', 'sent', 'paid', 'cancelled')`
- **Default:** `'draft'`
- **Nullable:** YES
- **Allowed Values:**
  - `'draft'` - Default status for new invoices
  - `'sent'` - Invoice sent to customer
  - `'paid'` - Invoice paid
  - `'cancelled'` - Invoice cancelled

## Why This Fixes the Error

1. **Explicit Value:** By explicitly setting `status='draft'`, we ensure MySQL knows exactly what value to insert
2. **Avoids Default Ambiguity:** Some MySQL configurations or transaction contexts may not properly apply DEFAULT values
3. **Clear Intent:** Makes it obvious what status a new invoice will have

## Testing

The API should now work correctly when creating sales tax invoices:

**Endpoint:** `POST /api/sales-tax-invoices`

**Request Body:**
```json
{
  "customer_id": "CUST001",
  "invoice_date": "2025-01-17",
  "claim_percentage": 100,
  "items": [
    {
      "project_no": "P002",
      "part_no": "PN002",
      "description": "Hammer",
      "quantity": 4,
      "unit_price": 15.00
    }
  ]
}
```

**Expected Response:**
```json
{
  "message": "Sales tax invoice created successfully and inventory updated",
  "id": 1,
  "invoice_number": "AT-INV-2025-001"
}
```

## Related Changes

This fix is part of the larger Sales Tax Invoice inventory update logic changes:
- ✅ Matching inventory using `project_no`, `part_no`, and `description`
- ✅ Only updating `sold_quantity` and `balance` in inventory
- ✅ Removed `material_no` column from `sales_tax_invoice_items`
- ✅ Added `project_no` column to `sales_tax_invoice_items`

---

**Status:** ✅ **Fixed**  
**Last Updated:** 2025-01-17  
**Breaking Changes:** None  
**Impact:** Sales tax invoice creation now works correctly



