# Sales Tax Invoice - Inventory Update Logic Changes

## Overview
Updated the inventory matching and update logic for Sales Tax Invoices to match on `project_no`, `part_no`, and `description` instead of `part_no` and `material_no`. The system now only updates `sold_quantity` and `balance` when creating or saving a Sales Tax Invoice.

## Changes Made

### 1. Database Schema Update
**File:** `backend/initDb.js`

- Added `project_no` field to `sales_tax_invoice_items` table
- Removed `material_no` field from `sales_tax_invoice_items` table

### 2. Backend Logic Updates
**File:** `backend/routes/salesTaxInvoices.js`

#### Inventory Validation (Lines 240-307)
- Changed matching criteria from `part_no` + `material_no` to `project_no` + `part_no` + `description`
- Updated error messages to reference the new fields
- Validation checks for `project_no`, `part_no`, and `description` presence

#### Invoice Items Creation (Lines 352-365)
- Updated INSERT query to include `project_no` instead of `material_no`
- Changed from: `invoice_id, part_no, material_no, description, quantity, unit_price, total_amount`
- Changed to: `invoice_id, project_no, part_no, description, quantity, unit_price, total_amount`

#### Inventory Update Logic (Lines 367-402)
- Changed WHERE clause to match on `project_no`, `part_no`, and `description`
- **Only updates `sold_quantity` and `balance`**
- Removed updates to `balance_amount` and `total_price`
- Other fields like `quantity`, `supplier_unit_price`, and `total_price` remain unchanged

#### Invoice Update (PUT) Endpoint (Lines 509-519)
- Updated INSERT query to use `project_no` instead of `material_no`

#### Customer PO Items Query (Lines 573-578)
- Changed SELECT to return `project_no` instead of `material_no`
- Updated to: `SELECT poi.project_no, poi.part_no, poi.description, poi.quantity, poi.unit_price`

### 3. Frontend Updates
**File:** `frontend/src/components/SalesTaxInvoice/index.js`

#### Form State (Line 73-80)
- Changed `material_no` to `project_no` in invoice loading

#### Table Header (Lines 500-507)
- Changed "Material No." to "Project No."
- Reordered columns to: QTY, Project No., Part No., Description, Unit Price, Total Amount

#### Input Fields (Lines 523-546)
- Added `project_no` input field
- Removed `material_no` input field
- Reordered columns in the table

#### Customer PO Change Handler (Lines 183-190)
- Updated to map `project_no` instead of `material_no`

#### Add Item Function (Lines 221-228)
- Updated to include `project_no` instead of `material_no`

## Key Behavior Changes

### Before
```javascript
// Matched on: part_no + material_no
WHERE part_no = ? AND material_no = ?

// Updated fields:
SET sold_quantity = ?,
    balance = ?,
    balance_amount = ?,
    total_price = ?,
    updated_at = CURRENT_TIMESTAMP
```

### After
```javascript
// Matches on: project_no + part_no + description
WHERE project_no = ? AND part_no = ? AND description = ?

// Only updates sold_quantity and balance:
SET sold_quantity = ?,
    balance = ?,
    updated_at = CURRENT_TIMESTAMP
```

## Important Notes

1. **Matching Criteria:** All three fields (`project_no`, `part_no`, `description`) must match exactly
2. **Update Scope:** Only `sold_quantity` and `balance` are updated - no other values changed
3. **Data Safety:** Prevents incorrect deductions by ensuring exact field matches
4. **Error Handling:** If fields don't match, no inventory record is updated

## Migration Notes

### For Existing Databases

If you have an existing database with the old schema, you'll need to:

1. Add the `project_no` column to `sales_tax_invoice_items` table:
```sql
ALTER TABLE sales_tax_invoice_items ADD COLUMN project_no VARCHAR(100);
```

2. Remove the `material_no` column (optional, if no longer needed):
```sql
ALTER TABLE sales_tax_invoice_items DROP COLUMN material_no;
```

3. For existing invoices, you may need to populate `project_no` from related purchase orders or leave it null for historical data.

## Testing Recommendations

1. **Create a new Sales Tax Invoice** with items that have:
   - Valid `project_no`
   - Valid `part_no`  
   - Valid `description`
   - Match existing inventory records

2. **Verify inventory updates**:
   - Only `sold_quantity` should increase
   - Only `balance` should decrease
   - `quantity`, `supplier_unit_price`, and `total_price` should remain unchanged

3. **Test with non-matching fields**:
   - Create invoice with `project_no` that doesn't match inventory
   - Should fail with validation error

4. **Test with partial match**:
   - Create invoice where `project_no` and `part_no` match but `description` doesn't
   - Should fail with "Item not found in inventory"

## API Response Examples

### Successful Inventory Update
```json
{
  "message": "Sales tax invoice created successfully and inventory updated",
  "id": 1,
  "invoice_number": "AT-INV-2025-001"
}
```

### Validation Error (Fields Don't Match)
```json
{
  "message": "Inventory validation failed. Cannot create sales invoice.",
  "validation_errors": [
    {
      "item_index": 1,
      "project_no": "PROJ-001",
      "part_no": "PART-001",
      "description": "Widget A",
      "requested_quantity": 50,
      "error": "Item not found in inventory"
    }
  ]
}
```

## Console Logging

The system now logs:
```
✓ Inventory updated: project_no=PROJ-001, part_no=PART-001, description=Widget A, sold_quantity: 0 + 50 = 50, new_balance=50
```

---

**Status:** ✅ **Completed**  
**Last Updated:** 2025-01-17  
**Breaking Changes:** Yes - Database schema change requires migration  
**Dependencies:** Requires project_no, part_no, and description in invoice items



