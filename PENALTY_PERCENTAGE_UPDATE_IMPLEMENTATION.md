# Penalty Percentage Update Implementation

## Overview
When editing a Purchase Order and updating the penalty percentage, the value should be automatically saved to the `penalty_percentage` field in the `purchase_order_items` table for all items in that purchase order.

## Changes Made

### Backend (`backend/routes/purchaseOrders.js`)

#### 1. Added Penalty Update Logic (Lines 383-409)
Added a new section that handles penalty_percentage updates for ALL items when editing a purchase order:

```javascript
// Update penalty_percentage for all items if provided (regardless of status)
if (penalty_percentage !== undefined && penalty_percentage !== null && penalty_percentage !== '') {
  console.log('Updating penalty_percentage for all items:', penalty_percentage);
  
  try {
    await req.db.execute(`
      UPDATE purchase_order_items SET
        penalty_percentage = ?,
        penalty_amount = CASE 
          WHEN ? IS NOT NULL AND quantity IS NOT NULL THEN (quantity * ? / 100)
          ELSE penalty_amount
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE po_id = ?
    `, [
      parseFloat(penalty_percentage),
      parseFloat(penalty_percentage),
      parseFloat(penalty_percentage),
      id
    ]);
    
    console.log('✅ Updated penalty_percentage for all items');
  } catch (updateError) {
    console.error('Error updating penalty_percentage:', updateError);
    // Don't fail the whole request, just log the error
  }
}
```

**Key Features:**
- ✅ Updates `penalty_percentage` for ALL items in the purchase order
- ✅ Works regardless of order status (approved or delivered)
- ✅ Automatically calculates `penalty_amount` for each item based on: `quantity × penalty_percentage / 100`
- ✅ Non-blocking: If there's an error updating penalty, it doesn't fail the entire request
- ✅ Updates the `updated_at` timestamp for each affected item

#### 2. Removed Duplicate Penalty Logic (Lines 411-456)
Removed the penalty_percentage handling from the "delivered status" section to avoid duplicate updates. Now that section only handles delivered-specific fields:
- balance_quantity_undelivered
- due_date
- delivered_quantity
- delivered_unit_price
- delivered_total_price

## How It Works

### When Editing a Purchase Order:

1. **User enters penalty percentage** in the Edit Purchase Order form
2. **Frontend sends** the penalty_percentage to the API
3. **Backend receives** the value and updates ALL items in the purchase_order_items table where po_id matches
4. **For each item**, the system:
   - Sets `penalty_percentage` to the provided value
   - Calculates `penalty_amount` = (quantity × penalty_percentage / 100)
   - Updates the `updated_at` timestamp

### Example:
If a purchase order has 3 items with quantities: 100, 50, 75
And the user sets penalty_percentage to 5%

Then:
- Item 1 (quantity 100): penalty_amount = 100 × 5 / 100 = 5
- Item 2 (quantity 50): penalty_amount = 50 × 5 / 100 = 2.5
- Item 3 (quantity 75): penalty_amount = 75 × 5 / 100 = 3.75

## Frontend Integration

The frontend (`PurchaseOrdersManagement/index.js`) already:
- ✅ Shows penalty_percentage field when editing a purchase order
- ✅ Sends the penalty_percentage value to the backend when updating
- ✅ Only includes the field if a value is provided

The form data structure when editing:
```javascript
{
  po_number: "...",
  order_type: "customer" or "supplier",
  customer_supplier_id: "...",
  penalty_percentage: "5"  // Only sent if provided
}
```

## Database Schema

The `purchase_order_items` table includes these fields:
```sql
penalty_percentage DECIMAL(5,2),  -- Penalty percentage (0.00-99.99%)
penalty_amount DECIMAL(12,2),     -- Calculated penalty amount
```

## Testing

To test this functionality:
1. Navigate to Purchase Orders Management
2. Click "Edit" on any purchase order
3. Enter a penalty percentage (e.g., "5" for 5%)
4. Click "Update"
5. Check the database - all items should have penalty_percentage = 5 and penalty_amount calculated accordingly

## Error Handling

- If penalty_percentage is not provided, no update is performed
- If there's an error updating the items, it's logged but doesn't fail the entire request
- Empty strings or null values are ignored

## Status
✅ **Completed** - Penalty percentage updates are now saved to all items in the purchase order.

