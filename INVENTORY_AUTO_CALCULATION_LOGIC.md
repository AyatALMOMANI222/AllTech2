# Inventory Auto-Calculation Logic

## Overview
The inventory API endpoints now automatically calculate all financial and stock tracking fields, ensuring accurate and consistent inventory management. Users only need to provide basic input fields, and the system handles all calculations.

## API Endpoints

### POST `/api/inventory` - Create New Inventory Item
### PUT `/api/inventory/:id` - Update Inventory Item

## Implementation Details

### Manual Input Fields (From User/Request)
These fields must be provided by the user or system:

```javascript
- serial_no          // Serial number
- project_no         // Project number
- date_po            // Purchase order date
- part_no            // Part number (unique identifier 1)
- material_no        // Material number (unique identifier 2)
- description        // Item description
- uom                // Unit of measure (PCS, KG, etc.)
- quantity           // Total quantity purchased
- supplier_unit_price // Unit price from supplier
- sold_quantity      // Quantity sold (only for UPDATE)
```

### Automatically Calculated Fields
These fields are **automatically calculated** by the backend:

```javascript
1. total_price = quantity × supplier_unit_price
   → Total value of inventory purchased

2. sold_quantity = 0 (for new items)
   → Initially zero, updated via sales invoices

3. balance = quantity - sold_quantity
   → Available stock remaining

4. balance_amount = balance × supplier_unit_price
   → Total value of remaining stock
```

### Database Auto-Handled Fields
```javascript
- id              // Auto-increment primary key
- created_at      // Timestamp on creation
- updated_at      // Timestamp on update
```

## POST - Create New Inventory Item

### Request Body
```json
{
  "serial_no": "001",
  "project_no": "PROJ-2025-001",
  "date_po": "2025-01-15",
  "part_no": "PART-001",
  "material_no": "MAT-001",
  "description": "High-grade steel bolt",
  "uom": "PCS",
  "quantity": 100,
  "supplier_unit_price": 25.50
}
```

**Note:** No need to provide `total_price`, `sold_quantity`, `balance`, or `balance_amount` - they're calculated automatically!

### Response
```json
{
  "message": "Inventory item created successfully",
  "id": 1,
  "calculated_values": {
    "total_price": 2550.00,
    "sold_quantity": 0,
    "balance": 100,
    "balance_amount": 2550.00
  }
}
```

### Calculations Performed
```javascript
Input:
  quantity = 100
  supplier_unit_price = 25.50

Automatic Calculations:
  total_price = 100 × 25.50 = 2,550.00
  sold_quantity = 0 (initial)
  balance = 100 - 0 = 100
  balance_amount = 100 × 25.50 = 2,550.00
```

### Console Log
```bash
✓ Inventory item created: part_no=PART-001, material_no=MAT-001, quantity=100, balance=100, total_price=2550.00
```

## PUT - Update Inventory Item

### Request Body
```json
{
  "serial_no": "001",
  "project_no": "PROJ-2025-001",
  "date_po": "2025-01-15",
  "part_no": "PART-001",
  "material_no": "MAT-001",
  "description": "High-grade steel bolt",
  "uom": "PCS",
  "quantity": 100,
  "supplier_unit_price": 25.50,
  "sold_quantity": 30
}
```

**Note:** When updating, you can provide `sold_quantity`, but `total_price`, `balance`, and `balance_amount` are still calculated automatically!

### Response
```json
{
  "message": "Inventory item updated successfully",
  "calculated_values": {
    "total_price": 2550.00,
    "balance": 70,
    "balance_amount": 1785.00
  }
}
```

### Calculations Performed
```javascript
Input:
  quantity = 100
  supplier_unit_price = 25.50
  sold_quantity = 30

Automatic Calculations:
  total_price = 100 × 25.50 = 2,550.00
  balance = 100 - 30 = 70
  balance_amount = 70 × 25.50 = 1,785.00
```

### Console Log
```bash
✓ Inventory item updated: id=1, quantity=100, sold_quantity=30, balance=70, total_price=2550.00
```

## Calculation Examples

### Example 1: New Inventory Item
```javascript
POST /api/inventory
{
  "quantity": 500,
  "supplier_unit_price": 12.75,
  ...other fields
}

Automatic Calculations:
✓ total_price = 500 × 12.75 = 6,375.00
✓ sold_quantity = 0
✓ balance = 500 - 0 = 500
✓ balance_amount = 500 × 12.75 = 6,375.00
```

### Example 2: After Some Sales
```javascript
PUT /api/inventory/1
{
  "quantity": 500,
  "supplier_unit_price": 12.75,
  "sold_quantity": 150,
  ...other fields
}

Automatic Calculations:
✓ total_price = 500 × 12.75 = 6,375.00
✓ balance = 500 - 150 = 350
✓ balance_amount = 350 × 12.75 = 4,462.50
```

### Example 3: Price Change
```javascript
PUT /api/inventory/1
{
  "quantity": 500,
  "supplier_unit_price": 15.00,  // Price increased
  "sold_quantity": 150,
  ...other fields
}

Automatic Calculations:
✓ total_price = 500 × 15.00 = 7,500.00
✓ balance = 500 - 150 = 350
✓ balance_amount = 350 × 15.00 = 5,250.00
```

### Example 4: Additional Purchase
```javascript
PUT /api/inventory/1
{
  "quantity": 700,  // Bought 200 more
  "supplier_unit_price": 15.00,
  "sold_quantity": 150,
  ...other fields
}

Automatic Calculations:
✓ total_price = 700 × 15.00 = 10,500.00
✓ balance = 700 - 150 = 550
✓ balance_amount = 550 × 15.00 = 8,250.00
```

## Field Definitions

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `serial_no` | VARCHAR(100) | Manual | Serial number for tracking |
| `project_no` | VARCHAR(100) | Manual | Associated project |
| `date_po` | DATE | Manual | Purchase order date |
| `part_no` | VARCHAR(100) | Manual | Part identifier |
| `material_no` | VARCHAR(100) | Manual | Material identifier |
| `description` | TEXT | Manual | Item description |
| `uom` | VARCHAR(50) | Manual | Unit of measure |
| `quantity` | DECIMAL(10,2) | Manual | Total quantity |
| `supplier_unit_price` | DECIMAL(10,2) | Manual | Price per unit |
| `total_price` | DECIMAL(10,2) | **Auto** | quantity × supplier_unit_price |
| `sold_quantity` | DECIMAL(10,2) | Manual/Auto | 0 (new) or from request (update) |
| `balance` | DECIMAL(10,2) | **Auto** | quantity - sold_quantity |
| `balance_amount` | DECIMAL(10,2) | **Auto** | balance × supplier_unit_price |

## Benefits

✅ **Consistency:** All calculations follow the same logic  
✅ **Accuracy:** No manual calculation errors  
✅ **Simplicity:** Users only provide essential data  
✅ **Reliability:** Backend ensures data integrity  
✅ **Auditability:** Console logs track all operations  
✅ **Maintainability:** Calculations centralized in one place  
✅ **Integration Ready:** Works seamlessly with invoice systems  

## Integration with Other Systems

### Purchase Tax Invoices
When a Purchase Tax Invoice is created:
- New items → POST /api/inventory (automatic calculations)
- Existing items → UPDATE quantity via smart import logic

### Sales Tax Invoices
When a Sales Tax Invoice is created:
- Validates balance availability
- Updates sold_quantity
- System recalculates balance and balance_amount automatically

### Import System
Excel/CSV imports:
- Checks existing items (part_no + material_no)
- New items → Automatic calculations applied
- Existing items → Quantities updated, balances recalculated

## Complete Lifecycle Example

### 1. Initial Purchase (POST)
```javascript
Input: quantity=100, unit_price=25.00

Calculated:
  total_price = 2,500.00
  sold_quantity = 0
  balance = 100
  balance_amount = 2,500.00
```

### 2. First Sale (via Sales Invoice)
```javascript
Sales invoice updates: sold_quantity += 30

System recalculates (PUT):
  balance = 100 - 30 = 70
  balance_amount = 70 × 25.00 = 1,750.00
```

### 3. Additional Purchase (via Purchase Invoice)
```javascript
Purchase invoice updates: quantity += 50

System recalculates (PUT):
  quantity = 150
  total_price = 150 × 25.00 = 3,750.00
  balance = 150 - 30 = 120
  balance_amount = 120 × 25.00 = 3,000.00
```

### 4. Second Sale
```javascript
Sales invoice updates: sold_quantity += 40

System recalculates (PUT):
  sold_quantity = 70
  balance = 150 - 70 = 80
  balance_amount = 80 × 25.00 = 2,000.00
```

### 5. Price Adjustment
```javascript
Manual update: unit_price = 28.00

System recalculates (PUT):
  total_price = 150 × 28.00 = 4,200.00
  balance_amount = 80 × 28.00 = 2,240.00
```

## Data Validation

The system validates:
- ✅ Numeric values are parsed correctly
- ✅ Zero/null values default to 0
- ✅ Calculations handle edge cases
- ✅ All monetary values to 2 decimal places

## Error Handling

```javascript
// Invalid quantity
Input: quantity = "abc"
Parsed: 0 (defaults to 0 if invalid)

// Missing unit price
Input: supplier_unit_price = undefined
Parsed: 0 (defaults to 0 if missing)

// Negative values
Input: quantity = -10
System allows (may need business rule to prevent)
```

## Frontend Integration

### Creating New Inventory
```javascript
const createInventory = async (data) => {
  const response = await api.post('/inventory', {
    serial_no: data.serial_no,
    project_no: data.project_no,
    date_po: data.date_po,
    part_no: data.part_no,
    material_no: data.material_no,
    description: data.description,
    uom: data.uom,
    quantity: data.quantity,
    supplier_unit_price: data.supplier_unit_price
    // No need to include calculated fields!
  });
  
  // Response includes calculated_values
  console.log('Calculated:', response.data.calculated_values);
};
```

### Updating Inventory
```javascript
const updateInventory = async (id, data) => {
  const response = await api.put(`/inventory/${id}`, {
    ...data,
    quantity: data.quantity,
    supplier_unit_price: data.supplier_unit_price,
    sold_quantity: data.sold_quantity
    // total_price, balance, balance_amount automatically calculated
  });
  
  console.log('Updated:', response.data.calculated_values);
};
```

## Testing Scenarios

### Test 1: Basic Creation
```bash
curl -X POST http://localhost:8000/api/inventory \
  -H "Content-Type: application/json" \
  -d '{
    "part_no": "TEST-001",
    "material_no": "MAT-001",
    "quantity": 100,
    "supplier_unit_price": 10.50,
    "description": "Test item",
    "uom": "PCS"
  }'

Expected:
{
  "id": 1,
  "calculated_values": {
    "total_price": 1050.00,
    "sold_quantity": 0,
    "balance": 100,
    "balance_amount": 1050.00
  }
}
```

### Test 2: Update After Sales
```bash
curl -X PUT http://localhost:8000/api/inventory/1 \
  -H "Content-Type: application/json" \
  -d '{
    "part_no": "TEST-001",
    "material_no": "MAT-001",
    "quantity": 100,
    "supplier_unit_price": 10.50,
    "sold_quantity": 25,
    "description": "Test item",
    "uom": "PCS"
  }'

Expected:
{
  "calculated_values": {
    "total_price": 1050.00,
    "balance": 75,
    "balance_amount": 787.50
  }
}
```

## Best Practices

1. **Always provide valid numeric values** for quantity and price
2. **Use consistent decimal precision** (2 decimal places recommended)
3. **Keep sold_quantity accurate** (updated by sales invoices)
4. **Review calculated_values** in responses for verification
5. **Monitor console logs** for tracking changes
6. **Don't manually override** calculated fields

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Incorrect total_price | Wrong quantity or price input | Verify input values |
| Negative balance | sold_quantity > quantity | Check sales records |
| Zero balance_amount | Unit price is 0 | Update supplier_unit_price |
| Calculation mismatch | Floating point precision | System uses 2 decimal places |

---

**Status:** ✅ **Fully Implemented**  
**Last Updated:** 2025-01-17  
**Version:** 1.0  
**Affects Endpoints:** POST /api/inventory, PUT /api/inventory/:id  
**Breaking Changes:** None (backward compatible)


