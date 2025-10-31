# Purchase Order Edit Fix Applied

## Issue
When updating a purchase order via `PUT http://localhost:8000/api/purchase-orders/:id`, the following error occurred:
```
"Error updating purchase order"
"Bind parameters must not contain undefined. To pass SQL NULL specify JS null"
```

## Root Cause
1. The frontend was sending `undefined` values for optional fields that weren't included in the request body
2. The backend SQL query was always including `status` in the UPDATE statement, even when it wasn't provided (undefined)
3. MySQL does not accept `undefined` as a bind parameter value - it needs to be explicitly `null` or the field should be omitted

## Fixes Applied

### Frontend Changes (`frontend/src/components/PurchaseOrdersManagement/index.js`)

1. **Removed fields from Edit form:**
   - ❌ Status
   - ❌ Delivered Quantity
   - ❌ Delivered Unit Price
   - ❌ Delivered Total Price
   - ✅ **Penalty %** (kept and made editable when editing)

2. **Updated form submission logic:**
   - When editing, only sends: `po_number`, `order_type`, `customer_supplier_id`, and `penalty_percentage` (if provided)
   - Prevents sending undefined values that would cause bind parameter errors
   - `customer_supplier_id` is always sent (null if empty)
   - `penalty_percentage` is only sent if it has a value

3. **Cleaned up form state:**
   - Removed unused fields from initial state
   - Updated `handleEdit` to only load necessary fields
   - Simplified `handleInputChange` (no longer calculates delivered totals)

### Backend Changes (`backend/routes/purchaseOrders.js`)

1. **Fixed undefined bind parameters:**
   - Modified the UPDATE query to conditionally include `status` field
   - If `status` is not provided (undefined), it's omitted from the query
   - Added proper variable declarations for `penalty_amount` and `balance_quantity_undelivered`

2. **Updated SQL query:**
   ```javascript
   // Before: Always included status with undefined causing errors
   status = COALESCE(?, status),
   
   // After: Only includes status if it's defined
   ${status !== undefined ? 'status = ?,' : ''}
   ```

## Result
✅ Edit Purchase Order form now only shows editable fields (Penalty % when editing)
✅ No more bind parameter errors when updating purchase orders
✅ Backend properly handles missing optional fields
✅ Status field removed from edit form as requested

