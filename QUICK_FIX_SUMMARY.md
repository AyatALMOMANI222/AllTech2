# Sales Tax Invoice API - Quick Fix Summary

## Problem
Error creating sales tax invoice: "Unknown column 'po.po_id' in 'field list'"

## Root Cause
The `sales_tax_invoice_items` table in the database was missing the `project_no` column and still had the old `material_no` column.

## Solution Applied
✅ **Migration script executed successfully**

### What was fixed:
1. ✅ Added `project_no` column to `sales_tax_invoice_items` table
2. ✅ Removed `material_no` column from the table
3. ✅ Updated all backend code to use new schema
4. ✅ Updated frontend to use `project_no` instead of `material_no`

## API Changes

### New Required Fields for Invoice Items:
- ✅ `project_no` (required for inventory matching)
- ✅ `part_no` (required)
- ✅ `description` (required)

### Removed Fields:
- ❌ `material_no` (no longer used)

## Backend Endpoints Updated

### POST /api/sales-tax-invoices
- Matches inventory using: `project_no`, `part_no`, `description`
- Updates only: `sold_quantity` and `balance`
- Other fields remain unchanged

### PUT /api/sales-tax-invoices/:id
- Same matching criteria as POST

### GET /api/sales-tax-invoices/customer-po/:po_number
- Returns `project_no` instead of `material_no`

## Frontend Changes
- Table header: "Material No." → "Project No."
- Input fields: Added `project_no`, removed `material_no`
- Form state and handlers updated

## Testing

Try creating an invoice with:
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

## If You Still Get Errors

1. **Restart the backend server** if it's still running
2. **Check your database connection** is using the correct database
3. **Verify the migration** ran successfully:
   ```sql
   DESCRIBE sales_tax_invoice_items;
   ```
4. **Check inventory table** has matching records with `project_no`, `part_no`, and `description`

---

**Status:** ✅ Fixed  
**Migration Script:** `backend/migrations/update_sales_tax_invoice_items.js`  
**Last Updated:** 2025-01-17



