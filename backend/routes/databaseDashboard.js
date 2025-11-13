const express = require('express');
const router = express.Router();

/**
 * Helper function to calculate and update delivered data for a Purchase Order
 * 
 * 🧾 DELIVERED PURCHASED ORDER Section Logic:
 * 
 * ⚠️ IMPORTANT: Supplier Delivered Purchased Orders work EXACTLY the same way as
 * Customer Delivered Sales Orders. All calculations and automatic updates are identical.
 * 
 * 1. Invoice Types (Automatic Detection):
 *    - Customer Purchase Orders → Pull from Sales Tax Invoices (Customer Invoices)
 *    - Supplier Purchase Orders → Pull from Purchase Tax Invoices (Supplier Invoices)
 *    - System automatically detects PO type (order_type) and fetches from matching invoice type
 * 
 * 2. Data Source Structure:
 *    - Customer Invoices: items[].quantity, items[].unit_price, items[].total_amount
 *    - Supplier Invoices: items[].quantity, items[].supplier_unit_price, items[].total_price
 * 
 * 3. Automatic Calculations (Per Item - NOT per invoice):
 *    - If multiple invoices link to the same PO item:
 *      * DELIVERED QUANTITY: Sum of all quantities per item across all related invoices
 *      * DELIVERED UNIT PRICE: Take from any related invoice (same for all items)
 *      * DELIVERED TOTAL PRICE = DELIVERED QUANTITY × DELIVERED UNIT PRICE
 * 
 * 4. Penalty and Balance (Per Item - Automatically Calculated):
 *    - PENALTY %: If value entered, use it; if not, leave empty
 *    - PENALTY AMOUNT: If PENALTY % exists → (PENALTY % × DELIVERED TOTAL PRICE) / 100
 *    - BALANCE QUANTITY UNDELIVERED = ORDERED QUANTITY (from APPROVED section) - DELIVERED QUANTITY
 * 
 * 5. Automatic Updates (Triggered When):
 *    - Purchase Tax Invoice (Supplier) is created → Recalculates Supplier PO
 *    - Purchase Tax Invoice (Supplier) is updated → Recalculates Supplier PO
 *    - Purchase Tax Invoice (Supplier) is deleted → Recalculates Supplier PO
 *    - Sales Tax Invoice (Customer) is created → Recalculates Customer PO
 *    - Sales Tax Invoice (Customer) is updated → Recalculates Customer PO
 *    - Sales Tax Invoice (Customer) is deleted → Recalculates Customer PO
 *    - Purchase Order items are updated → Recalculates delivered data
 *    - Purchase Order penalty_percentage is updated → Recalculates penalty_amount
 * 
 * 6. Storage:
 *    - All calculated values are stored in purchase_order_items table:
 *      * delivered_quantity
 *      * delivered_unit_price
 *      * delivered_total_price
 *      * penalty_amount
 *      * balance_quantity_undelivered
 *      * invoice_no (comma-separated list of invoice numbers)
 * 
 * 7. Display Conditions:
 *    - Show in DELIVERED PURCHASED ORDER section ONLY when PO status is:
 *      * "partially_delivered" (partial delivery)
 *      * "delivered_completed" (complete delivery)
 *    - Applies to BOTH Customer and Supplier Purchase Orders
 */
async function calculateAndUpdateDeliveredData(db, poId) {
  try {
    console.log(`Calculating delivered data for PO: ${poId}`);
    
    // Get the Purchase Order
    const [pos] = await db.execute(
      'SELECT * FROM purchase_orders WHERE id = ?',
      [poId]
    );
    
    if (pos.length === 0) {
      console.log(`PO ${poId} not found`);
      return;
    }
    
    const po = pos[0];
    const isSupplier = po.order_type === 'supplier';
    const poNumber = po.po_number;
    
    // Get all items for this PO
    const [items] = await db.execute(
      'SELECT * FROM purchase_order_items WHERE po_id = ?',
      [poId]
    );
    
    if (items.length === 0) {
      console.log(`No items found for PO ${poId}`);
      return;
    }
    
    // For each item, calculate delivered data from invoices
    for (const item of items) {
      let deliveredQuantity = 0;
      let deliveredUnitPrice = null;
      let invoiceNumbers = [];
      
      if (isSupplier) {
        // SUPPLIER Purchase Orders: Pull data from Purchase Tax Invoices (Supplier Invoices)
        // Data Source: items[].quantity, items[].supplier_unit_price, items[].total_price
        const [invoices] = await db.execute(`
          SELECT pti.*, ptii.quantity, ptii.supplier_unit_price, ptii.total_price
          FROM purchase_tax_invoices pti
          INNER JOIN purchase_tax_invoice_items ptii ON pti.id = ptii.invoice_id
          WHERE pti.po_number = ? 
            AND ptii.part_no = ? 
            AND (ptii.material_no = ? OR (ptii.material_no IS NULL AND ? IS NULL))
        `, [poNumber, item.part_no, item.material_no, item.material_no]);
        
        // DELIVERED QUANTITY: Sum of all quantities per item across all related invoices
        // DELIVERED UNIT PRICE: Take from any related invoice (assume same price for all invoices)
        for (const inv of invoices) {
          deliveredQuantity += parseFloat(inv.quantity) || 0;
          if (deliveredUnitPrice === null && inv.supplier_unit_price) {
            deliveredUnitPrice = parseFloat(inv.supplier_unit_price);
          }
          if (inv.invoice_number) {
            invoiceNumbers.push(inv.invoice_number);
          }
        }
        console.log(`✓ Found ${invoices.length} invoice(s) for PO item part_no=${item.part_no}, material_no=${item.material_no || 'NULL'}, delivered_quantity=${deliveredQuantity}`);
      } else {
        // CUSTOMER Purchase Orders: Pull data from Sales Tax Invoices (Customer Invoices)
        // Data Source: items[].quantity, items[].unit_price, items[].total_amount
        const [invoices] = await db.execute(`
          SELECT sti.*, stii.quantity, stii.unit_price, stii.total_amount
          FROM sales_tax_invoices sti
          INNER JOIN sales_tax_invoice_items stii ON sti.id = stii.invoice_id
          WHERE sti.customer_po_number = ? 
            AND stii.part_no = ? 
            AND (stii.material_no = ? OR (stii.material_no IS NULL AND ? IS NULL))
        `, [poNumber, item.part_no, item.material_no, item.material_no]);
        
        // DELIVERED QUANTITY: Sum of all quantities per item across all related invoices
        // DELIVERED UNIT PRICE: Take from any related invoice (assume same price for all invoices)
        for (const inv of invoices) {
          deliveredQuantity += parseFloat(inv.quantity) || 0;
          if (deliveredUnitPrice === null && inv.unit_price) {
            deliveredUnitPrice = parseFloat(inv.unit_price);
          }
          if (inv.invoice_number) {
            invoiceNumbers.push(inv.invoice_number);
          }
        }
        console.log(`✓ Found ${invoices.length} invoice(s) for PO item part_no=${item.part_no}, material_no=${item.material_no || 'NULL'}, delivered_quantity=${deliveredQuantity}`);
      }
      
      // DELIVERED TOTAL PRICE = DELIVERED QUANTITY × DELIVERED UNIT PRICE
      const deliveredTotalPrice = deliveredQuantity * (deliveredUnitPrice || 0);
      
      // PENALTY %: If entered, use it; otherwise, leave empty
      const penaltyPercentage = item.penalty_percentage || null;
      
      // PENALTY AMOUNT = (PENALTY % × DELIVERED TOTAL PRICE) / 100 (if PENALTY % exists)
      let penaltyAmount = null;
      if (penaltyPercentage !== null && penaltyPercentage !== '' && deliveredTotalPrice > 0) {
        penaltyAmount = (parseFloat(penaltyPercentage) * deliveredTotalPrice) / 100;
      }
      
      // BALANCE QUANTITY UNDELIVERED = ORDERED QUANTITY - DELIVERED QUANTITY
      const balanceQuantityUndelivered = (parseFloat(item.quantity) || 0) - deliveredQuantity;
      
      // Update the item
      await db.execute(`
        UPDATE purchase_order_items SET
          delivered_quantity = ?,
          delivered_unit_price = ?,
          delivered_total_price = ?,
          penalty_amount = ?,
          balance_quantity_undelivered = ?,
          invoice_no = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        deliveredQuantity || null,
        deliveredUnitPrice || null,
        deliveredTotalPrice || null,
        penaltyAmount,
        balanceQuantityUndelivered,
        invoiceNumbers.join(', ') || null,
        item.id
      ]);
      
      console.log(`✓ Updated item ${item.id}: delivered=${deliveredQuantity}, balance=${balanceQuantityUndelivered}`);
    }
    
    // Update PO status based on delivery
    // Status should be 'partially_delivered' or 'delivered_completed' based on quantities
    // ⚠️ IMPORTANT: Once an invoice is created, status should update to show in DELIVERED section
    // This works regardless of penalty_percentage value (can be empty/null)
    const [updatedItems] = await db.execute(
      'SELECT quantity, delivered_quantity FROM purchase_order_items WHERE po_id = ?',
      [poId]
    );
    
    if (updatedItems.length > 0) {
      let totalOrdered = 0;
      let totalDelivered = 0;
      let hasDeliveredItems = false;
    
    for (const itm of updatedItems) {
      const qty = parseFloat(itm.quantity) || 0;
      const delQty = parseFloat(itm.delivered_quantity) || 0;
        totalOrdered += qty;
        totalDelivered += delQty;
        if (delQty > 0) {
          hasDeliveredItems = true;
      }
    }
    
    // Set appropriate status
      // ⚠️ Once any invoice exists and has delivered quantities, update status accordingly
      // Records appear in DELIVERED section regardless of penalty_percentage value
      // ⚠️ IMPORTANT: Status is updated based ONLY on delivered_quantity, NOT on penalty_percentage
      // ⚠️ Once an invoice is created (Sales or Purchase Tax Invoice), status should update to show in DELIVERED section
    let newStatus = po.status;
      if (hasDeliveredItems) {
        if (totalDelivered >= totalOrdered) {
          newStatus = 'delivered_completed';
        } else if (totalDelivered > 0) {
      newStatus = 'partially_delivered';
        }
        // If totalDelivered is 0, keep status as 'approved' (no invoices matched PO items)
    }
    
    // Only update if status changed
    if (newStatus !== po.status) {
      await db.execute('UPDATE purchase_orders SET status = ? WHERE id = ?', [newStatus, poId]);
        console.log(`✓ Updated PO ${poId} status to ${newStatus} (totalDelivered: ${totalDelivered}, totalOrdered: ${totalOrdered})`);
      } else {
        console.log(`✓ PO ${poId} status remains ${po.status} (totalDelivered: ${totalDelivered}, totalOrdered: ${totalOrdered})`);
      }
    }
    
    console.log(`✓ Completed calculation for PO ${poId}`);
  } catch (error) {
    console.error(`Error calculating delivered data for PO ${poId}:`, error);
    // Don't throw - just log the error
  }
}

// GET /api/database-dashboard - Get unified database dashboard
router.get('/', async (req, res) => {
  try {
    const { search, as_of_date, page = 1, limit = 100 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    
    // Base query to get all Purchase Order items with related inventory and invoice data
    // ⚠️ IMPORTANT: Query starts from purchase_order_items to display ALL PO items
    // ⚠️ DEDUPLICATION: Group by PROJECT NO, PART NO, MATERIAL NO, DESCRIPTION, UOM to avoid duplicate rows
    // Inventory data is LEFT JOINed to show inventory info when available, but is NOT required
    let query = `
      SELECT 
        -- Group by these fields to ensure unique items (no duplicates)
        -- Use CASE to match GROUP BY clause exactly (required for ONLY_FULL_GROUP_BY)
        -- This ensures items with different PROJECT NO values appear as separate rows
        CASE WHEN poi.project_no IS NULL THEN CONCAT('__NULL_PROJECT__', poi.id) ELSE poi.project_no END as project_no,
        CASE WHEN poi.part_no IS NULL THEN CONCAT('__NULL_PART__', poi.id) ELSE poi.part_no END as part_no,
        CASE WHEN poi.material_no IS NULL THEN CONCAT('__NULL_MATERIAL__', poi.id) ELSE poi.material_no END as material_no,
        CASE WHEN poi.description IS NULL THEN CONCAT('__NULL_DESC__', poi.id) ELSE poi.description END as description,
        CASE WHEN poi.uom IS NULL THEN CONCAT('__NULL_UOM__', poi.id) ELSE poi.uom END as uom,
        
        -- Aggregate other fields when multiple PO items match the same combination
        MIN(poi.id) as po_item_id,
        MIN(poi.serial_no) as serial_no,
        MIN(poi.date_po) as date_po,
        
        -- Aggregate other fields when multiple PO items match the same combination
        ANY_VALUE(poi.lead_time) as lead_time,
        ANY_VALUE(poi.due_date) as due_date,
        
        -- Combine PO information (use GROUP_CONCAT for multiple POs)
        -- When items are grouped, multiple POs may be combined, so we aggregate their information
        GROUP_CONCAT(DISTINCT po.id ORDER BY po.id SEPARATOR ',') as po_ids,
        GROUP_CONCAT(DISTINCT po.po_number ORDER BY po.po_number SEPARATOR ', ') as po_number,
        -- order_type: When items are grouped, order_type may contain both 'supplier' and 'customer'
        -- Use GROUP_CONCAT to combine all order_types, then frontend will handle displaying in appropriate columns
        GROUP_CONCAT(DISTINCT po.order_type ORDER BY po.order_type SEPARATOR ', ') as order_type,
        -- Status: if any PO is delivered, show delivered status
        CASE 
          WHEN SUM(CASE WHEN po.status IN ('partially_delivered', 'delivered_completed') THEN 1 ELSE 0 END) > 0
          THEN MAX(CASE WHEN po.status IN ('partially_delivered', 'delivered_completed') THEN po.status ELSE NULL END)
          ELSE MAX(CASE WHEN po.status = 'approved' THEN 'approved' ELSE NULL END)
        END as po_status,
        
        -- Separate status for supplier and customer POs
        -- Supplier status: if any supplier PO is delivered, show delivered status
        CASE 
          WHEN SUM(CASE WHEN po.order_type = 'supplier' AND po.status IN ('partially_delivered', 'delivered_completed') THEN 1 ELSE 0 END) > 0
          THEN MAX(CASE WHEN po.order_type = 'supplier' AND po.status IN ('partially_delivered', 'delivered_completed') THEN po.status ELSE NULL END)
          WHEN SUM(CASE WHEN po.order_type = 'supplier' AND po.status = 'approved' THEN 1 ELSE 0 END) > 0
          THEN 'approved'
          ELSE NULL
        END as supplier_po_status,
        
        -- Customer status: if any customer PO is delivered, show delivered status
        CASE 
          WHEN SUM(CASE WHEN po.order_type = 'customer' AND po.status IN ('partially_delivered', 'delivered_completed') THEN 1 ELSE 0 END) > 0
          THEN MAX(CASE WHEN po.order_type = 'customer' AND po.status IN ('partially_delivered', 'delivered_completed') THEN po.status ELSE NULL END)
          WHEN SUM(CASE WHEN po.order_type = 'customer' AND po.status = 'approved' THEN 1 ELSE 0 END) > 0
          THEN 'approved'
          ELSE NULL
        END as customer_po_status,
        
        -- Overall aggregated quantities (for backward compatibility and summary)
        SUM(COALESCE(poi.quantity, 0)) as po_quantity,
        AVG(COALESCE(poi.unit_price, 0)) as po_unit_price,
        SUM(COALESCE(poi.total_price, 0)) as po_total_price,
        
        GROUP_CONCAT(DISTINCT cs.id ORDER BY cs.id SEPARATOR ',') as customer_supplier_ids,
        GROUP_CONCAT(DISTINCT cs.company_name ORDER BY cs.company_name SEPARATOR ', ') as customer_supplier_name,
        
        -- Aggregate delivered quantities separately for supplier and customer POs
        -- Supplier delivered quantities
        SUM(CASE WHEN po.order_type = 'supplier' THEN COALESCE(poi.delivered_quantity, 0) ELSE 0 END) as supplier_delivered_quantity,
        AVG(CASE WHEN po.order_type = 'supplier' AND poi.delivered_unit_price IS NOT NULL AND poi.delivered_unit_price > 0 
            THEN poi.delivered_unit_price ELSE NULL END) as supplier_delivered_unit_price,
        SUM(CASE WHEN po.order_type = 'supplier' THEN COALESCE(poi.delivered_total_price, 0) ELSE 0 END) as supplier_delivered_total_price,
        MAX(CASE WHEN po.order_type = 'supplier' THEN poi.penalty_percentage ELSE NULL END) as supplier_penalty_percentage,
        SUM(CASE WHEN po.order_type = 'supplier' THEN COALESCE(poi.penalty_amount, 0) ELSE 0 END) as supplier_penalty_amount,
        GROUP_CONCAT(DISTINCT CASE WHEN po.order_type = 'supplier' THEN poi.invoice_no ELSE NULL END 
            ORDER BY poi.invoice_no SEPARATOR ', ') as supplier_invoice_no,
        SUM(CASE WHEN po.order_type = 'supplier' THEN COALESCE(poi.balance_quantity_undelivered, 0) ELSE 0 END) as supplier_balance_quantity_undelivered,
        
        -- Customer delivered quantities
        SUM(CASE WHEN po.order_type = 'customer' THEN COALESCE(poi.delivered_quantity, 0) ELSE 0 END) as customer_delivered_quantity,
        AVG(CASE WHEN po.order_type = 'customer' AND poi.delivered_unit_price IS NOT NULL AND poi.delivered_unit_price > 0 
            THEN poi.delivered_unit_price ELSE NULL END) as customer_delivered_unit_price,
        SUM(CASE WHEN po.order_type = 'customer' THEN COALESCE(poi.delivered_total_price, 0) ELSE 0 END) as customer_delivered_total_price,
        MAX(CASE WHEN po.order_type = 'customer' THEN poi.penalty_percentage ELSE NULL END) as customer_penalty_percentage,
        SUM(CASE WHEN po.order_type = 'customer' THEN COALESCE(poi.penalty_amount, 0) ELSE 0 END) as customer_penalty_amount,
        GROUP_CONCAT(DISTINCT CASE WHEN po.order_type = 'customer' THEN poi.invoice_no ELSE NULL END 
            ORDER BY poi.invoice_no SEPARATOR ', ') as customer_invoice_no,
        SUM(CASE WHEN po.order_type = 'customer' THEN COALESCE(poi.balance_quantity_undelivered, 0) ELSE 0 END) as customer_balance_quantity_undelivered,
        
        -- Aggregate approved quantities separately for supplier and customer POs
        SUM(CASE WHEN po.order_type = 'supplier' THEN COALESCE(poi.quantity, 0) ELSE 0 END) as supplier_po_quantity,
        AVG(CASE WHEN po.order_type = 'supplier' THEN COALESCE(poi.unit_price, 0) ELSE NULL END) as supplier_po_unit_price,
        SUM(CASE WHEN po.order_type = 'supplier' THEN COALESCE(poi.total_price, 0) ELSE 0 END) as supplier_po_total_price,
        
        SUM(CASE WHEN po.order_type = 'customer' THEN COALESCE(poi.quantity, 0) ELSE 0 END) as customer_po_quantity,
        AVG(CASE WHEN po.order_type = 'customer' THEN COALESCE(poi.unit_price, 0) ELSE NULL END) as customer_po_unit_price,
        SUM(CASE WHEN po.order_type = 'customer' THEN COALESCE(poi.total_price, 0) ELSE 0 END) as customer_po_total_price,
        
        -- Inventory data (if exists) - LEFT JOIN so it's optional
        -- Use MAX() aggregation since we're grouping and there might be multiple inventory matches
        MAX(i.id) as inventory_id,
        MAX(i.quantity) as inventory_quantity,
        MAX(i.supplier_unit_price) as inventory_unit_price,
        MAX(i.total_price) as inventory_total_price,
        MAX(i.sold_quantity) as inventory_sold_quantity,
        MAX(i.balance) as inventory_balance,
        MAX(i.balance_amount) as inventory_balance_amount,
        
        -- Approved Orders data (for grouped PO items)
        -- Shows PO data if status is 'approved', 'partially_delivered', or 'delivered_completed'
        -- NOTE: Delivered POs appear in BOTH approved and delivered sections
        -- Use GROUP_CONCAT to combine multiple POs for the same item
        GROUP_CONCAT(DISTINCT CASE 
          WHEN po.status IN ('approved', 'partially_delivered', 'delivered_completed')
          THEN CONCAT(
            poi.quantity, '|',
            poi.unit_price, '|',
            (poi.quantity * poi.unit_price), '|',
            COALESCE(poi.lead_time, ''), '|',
            COALESCE(poi.due_date, ''), '|',
            COALESCE(cs.company_name, ''),
            '|',
            COALESCE(po.po_number, ''),
            '|',
            COALESCE(po.order_type, ''),
            '|',
            COALESCE(po.status, '')
          )
          ELSE NULL 
        END SEPARATOR '||') as approved_orders_data,
        
        -- 📦 DELIVERED PURCHASED ORDER Section
        -- ⚠️ Display Condition: Show ONLY when PO status is "partially_delivered" or "delivered_completed"
        -- ⚠️ IMPORTANT: Records are displayed REGARDLESS of penalty_percentage or penalty_amount values
        -- Records appear immediately when status changes to partially_delivered or delivered_completed
        -- NOTE: These POs ALSO appear in the APPROVED section above (showing original approved data)
        -- A PO appears in BOTH sections when it becomes delivered - it is NOT removed from approved section
        -- Use GROUP_CONCAT to combine multiple delivered POs for the same item
        GROUP_CONCAT(DISTINCT CASE 
          WHEN po.status IN ('partially_delivered', 'delivered_completed')
          THEN CONCAT(
            poi.quantity, '|',                    -- ORDERED QUANTITY (from APPROVED section)
            poi.unit_price, '|',                  -- Original unit price
            (poi.quantity * poi.unit_price), '|',  -- Original total
            COALESCE(poi.lead_time, ''), '|',
            COALESCE(poi.due_date, ''), '|',
            COALESCE(poi.delivered_quantity, ''), '|',       -- DELIVERED QUANTITY (sum from invoices)
            COALESCE(poi.delivered_unit_price, ''), '|',     -- DELIVERED UNIT PRICE (from invoices)
            COALESCE(poi.delivered_total_price, ''), '|',    -- DELIVERED TOTAL PRICE (calculated)
            COALESCE(NULLIF(poi.penalty_percentage, ''), '0'), '|',  -- PENALTY % (convert empty/null to '0' - does NOT affect display)
            COALESCE(NULLIF(poi.penalty_amount, ''), '0'), '|',      -- PENALTY AMOUNT (convert empty/null to '0' - does NOT affect display)
            COALESCE(poi.invoice_no, ''), '|',               -- Invoice numbers
            COALESCE(poi.balance_quantity_undelivered, ''), '|',  -- BALANCE (ORDERED - DELIVERED)
            COALESCE(cs.company_name, ''),
            '|',
            COALESCE(po.po_number, ''),
            '|',
            COALESCE(po.order_type, ''),
            '|',
            COALESCE(po.status, '')
          )
          ELSE NULL 
        END SEPARATOR '||') as delivered_orders_data,
        
        -- Purchase Tax Invoice data (matching by part_no, material_no)
        GROUP_CONCAT(DISTINCT CASE 
          WHEN pti.id IS NOT NULL
          THEN CONCAT(
            ptii.quantity, '|',
            ptii.supplier_unit_price, '|',
            ptii.total_price, '|',
            pti.invoice_number, '|',
            COALESCE(cs_pti_supplier.company_name, '')
          )
          ELSE NULL 
        END SEPARATOR '||') as purchase_invoice_data,
        
        -- Sales Tax Invoice data (matching by part_no, material_no)
        GROUP_CONCAT(DISTINCT CASE 
          WHEN sti.id IS NOT NULL
          THEN CONCAT(
            stii.quantity, '|',
            stii.unit_price, '|',
            stii.total_amount, '|',
            sti.invoice_number, '|',
            COALESCE(cs_sti_customer.company_name, '')
          )
          ELSE NULL 
        END SEPARATOR '||') as sales_invoice_data
        
      FROM purchase_order_items poi
      
      -- Join with Purchase Order
      INNER JOIN purchase_orders po 
        ON poi.po_id = po.id
      
      -- Join with Customer/Supplier
      LEFT JOIN customers_suppliers cs 
        ON po.customer_supplier_id = cs.id
      
      -- Join with Inventory (optional - to show inventory data if it exists)
      -- Match by part_no, material_no, project_no, description, and supplier_unit_price
      LEFT JOIN inventory i
        ON poi.part_no = i.part_no 
        AND (poi.material_no = i.material_no OR (poi.material_no IS NULL AND i.material_no IS NULL))
        AND (poi.project_no = i.project_no OR (poi.project_no IS NULL AND i.project_no IS NULL))
      
      -- Join with Purchase Tax Invoices - Match by part_no, material_no
      LEFT JOIN purchase_tax_invoice_items ptii
        ON poi.part_no = ptii.part_no 
        AND (poi.material_no = ptii.material_no OR (poi.material_no IS NULL AND ptii.material_no IS NULL))
      LEFT JOIN purchase_tax_invoices pti
        ON ptii.invoice_id = pti.id
      LEFT JOIN customers_suppliers cs_pti_supplier
        ON pti.supplier_id = cs_pti_supplier.id
      
      -- Join with Sales Tax Invoices - Match by part_no, material_no
      LEFT JOIN sales_tax_invoice_items stii
        ON poi.part_no = stii.part_no 
        AND (poi.material_no = stii.material_no OR (poi.material_no IS NULL AND stii.material_no IS NULL))
      LEFT JOIN sales_tax_invoices sti
        ON stii.invoice_id = sti.id
      LEFT JOIN customers_suppliers cs_sti_customer
        ON sti.customer_id = cs_sti_customer.id
      
      WHERE 1=1
    `;
    
    let params = [];
    
    // Filter by PO status: show only approved, partially_delivered, or delivered_completed
    // This ensures we only show relevant PO items in the dashboard
    query += ` AND po.status IN ('approved', 'partially_delivered', 'delivered_completed')`;
    
    // Add date filter if provided (filter by PO creation date or PO item date_po)
    if (as_of_date) {
      query += ` AND (DATE(po.created_at) <= ? OR DATE(poi.date_po) <= ?)`;
      params.push(as_of_date, as_of_date);
    }
    
    // Add search filter (search in PO item fields)
    if (search) {
      query += ` AND (
        poi.serial_no LIKE ? OR 
        poi.project_no LIKE ? OR 
        poi.part_no LIKE ? OR 
        poi.material_no LIKE ? OR 
        poi.description LIKE ? OR
        po.po_number LIKE ?
      )`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
    }
    
    // Group by PROJECT NO, PART NO, MATERIAL NO, DESCRIPTION, UOM to ensure unique items (no duplicates)
    // Items with the same values for ALL these fields will be combined into a single row
    // Items with different PROJECT NO values will appear as separate rows
    // Handle NULL values properly in GROUP BY - use COALESCE but ensure NULLs are distinct
    // Use CONCAT with a unique marker to distinguish NULL from empty string and ensure proper grouping
    query += ` 
      GROUP BY 
        CASE WHEN poi.project_no IS NULL THEN CONCAT('__NULL_PROJECT__', poi.id) ELSE poi.project_no END,
        CASE WHEN poi.part_no IS NULL THEN CONCAT('__NULL_PART__', poi.id) ELSE poi.part_no END,
        CASE WHEN poi.material_no IS NULL THEN CONCAT('__NULL_MATERIAL__', poi.id) ELSE poi.material_no END,
        CASE WHEN poi.description IS NULL THEN CONCAT('__NULL_DESC__', poi.id) ELSE poi.description END,
        CASE WHEN poi.uom IS NULL THEN CONCAT('__NULL_UOM__', poi.id) ELSE poi.uom END
      ORDER BY MIN(po.created_at) DESC, MIN(poi.serial_no) ASC 
      LIMIT ${limitNum} OFFSET ${offset}`;
    
    const [items] = await req.db.execute(query, params);
    
    // Get total count for pagination (count distinct combinations of project_no, part_no, material_no, description, uom)
    // Use the same CASE logic as the main query to ensure consistent counting
    let countQuery = `
      SELECT COUNT(DISTINCT CONCAT(
        CASE WHEN poi.project_no IS NULL THEN CONCAT('__NULL_PROJECT__', poi.id) ELSE poi.project_no END, '|',
        CASE WHEN poi.part_no IS NULL THEN CONCAT('__NULL_PART__', poi.id) ELSE poi.part_no END, '|',
        CASE WHEN poi.material_no IS NULL THEN CONCAT('__NULL_MATERIAL__', poi.id) ELSE poi.material_no END, '|',
        CASE WHEN poi.description IS NULL THEN CONCAT('__NULL_DESC__', poi.id) ELSE poi.description END, '|',
        CASE WHEN poi.uom IS NULL THEN CONCAT('__NULL_UOM__', poi.id) ELSE poi.uom END
      )) as total
      FROM purchase_order_items poi
      INNER JOIN purchase_orders po 
        ON poi.po_id = po.id
      WHERE po.status IN ('approved', 'partially_delivered', 'delivered_completed')
    `;
    
    const countParams = [];
    
    if (as_of_date) {
      countQuery += ` AND (DATE(po.created_at) <= ? OR DATE(poi.date_po) <= ?)`;
      countParams.push(as_of_date, as_of_date);
    }
    
    if (search) {
      countQuery += ` AND (
        poi.serial_no LIKE ? OR 
        poi.project_no LIKE ? OR 
        poi.part_no LIKE ? OR 
        poi.material_no LIKE ? OR 
        poi.description LIKE ? OR
        po.po_number LIKE ?
      )`;
      const searchParam = `%${search}%`;
      countParams.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
    }
    
    const [countResult] = await req.db.execute(countQuery, countParams);
    const totalItems = countResult[0].total;
    
    // Process the data into structured format
    // Each item represents a unique combination of PROJECT NO, PART NO, MATERIAL NO, DESCRIPTION, UOM
    // Multiple PO items with the same values for these fields are combined into a single row
    const processedItems = items.map(item => {
      // Parse approved orders data (may contain multiple POs separated by '||')
      // NOTE: Delivered POs appear in BOTH approved and delivered sections
      const approvedOrders = [];
      if (item.approved_orders_data) {
        const orders = item.approved_orders_data.split('||').filter(data => data && data.trim() !== '');
        orders.forEach(orderData => {
          const parts = orderData.split('|');
          approvedOrders.push({
            quantity: parseFloat(parts[0]) || 0,
            unit_price: parseFloat(parts[1]) || 0,
            total_price: parseFloat(parts[2]) || 0,
            lead_time: parts[3] || '',
            due_date: parts[4] || '',
            supplier_name: parts[5] || '',
            po_number: parts[6] || '',
            order_type: parts[7] || '',
            status: parts[8] || 'approved'
          });
        });
      }
      
      // Parse delivered orders data (may contain multiple POs separated by '||')
      // ⚠️ IMPORTANT: Records are included regardless of penalty_percentage value (can be empty/null)
      // ⚠️ Records appear when PO status is 'partially_delivered' or 'delivered_completed'
      // ⚠️ NOTE: These POs ALSO appear in the APPROVED section above - they are NOT removed from approved section
      const deliveredOrders = [];
      if (item.delivered_orders_data) {
        const orders = item.delivered_orders_data.split('||').filter(data => data && data.trim() !== '');
        orders.forEach(orderData => {
          const parts = orderData.split('|');
          deliveredOrders.push({
              quantity: parseFloat(parts[0]) || 0,
              unit_price: parseFloat(parts[1]) || 0,
              total_price: parseFloat(parts[2]) || 0,
              lead_time: parts[3] || '',
              due_date: parts[4] || '',
              delivered_quantity: parts[5] ? parseFloat(parts[5]) : 0,
              delivered_unit_price: parts[6] ? parseFloat(parts[6]) : 0,
              delivered_total_price: parts[7] ? parseFloat(parts[7]) : 0,
              penalty_percentage: parts[8] !== undefined ? (parts[8] || '0') : '0',  // Convert empty/null to '0'
              penalty_amount: parts[9] !== undefined ? (parts[9] || '0') : '0',      // Convert empty/null to '0'
              invoice_no: parts[10] || '',
              balance_quantity_undelivered: parts[11] || '',
              supplier_name: parts[12] || '',
              po_number: parts[13] || '',
              order_type: parts[14] || '',
              status: parts[15] || ''
          });
        });
      }
      
      // Parse purchase invoices
      const purchaseInvoices = item.purchase_invoice_data
        ? item.purchase_invoice_data.split('||').filter(data => data && data.trim() !== '').map(data => {
            const parts = data.split('|');
            return {
              quantity: parseFloat(parts[0]) || 0,
              unit_price: parseFloat(parts[1]) || 0,
              total_price: parseFloat(parts[2]) || 0,
              invoice_no: parts[3] || '',
              supplier_name: parts[4] || ''
            };
          })
        : [];
      
      // Parse sales invoices
      const salesInvoices = item.sales_invoice_data
        ? item.sales_invoice_data.split('||').filter(data => data && data.trim() !== '').map(data => {
            const parts = data.split('|');
            return {
              quantity: parseFloat(parts[0]) || 0,
              unit_price: parseFloat(parts[1]) || 0,
              total_price: parseFloat(parts[2]) || 0,
              invoice_no: parts[3] || '',
              customer_name: parts[4] || ''
            };
          })
        : [];
      
      return {
        // Purchase Order Item base data (primary data source)
        id: item.po_item_id,
        po_id: item.po_id,
        serial_no: item.serial_no,
        // Clean up project_no - remove NULL markers if present
        project_no: item.project_no && typeof item.project_no === 'string' && item.project_no.startsWith('__NULL_PROJECT__') ? null : item.project_no,
        date_po: item.date_po,
        // Clean up other fields - remove NULL markers if present
        part_no: item.part_no && typeof item.part_no === 'string' && item.part_no.startsWith('__NULL_PART__') ? null : item.part_no,
        material_no: item.material_no && typeof item.material_no === 'string' && item.material_no.startsWith('__NULL_MATERIAL__') ? null : item.material_no,
        description: item.description && typeof item.description === 'string' && item.description.startsWith('__NULL_DESC__') ? null : item.description,
        uom: item.uom && typeof item.uom === 'string' && item.uom.startsWith('__NULL_UOM__') ? null : item.uom,
        po_quantity: parseFloat(item.po_quantity) || 0,
        po_unit_price: parseFloat(item.po_unit_price) || 0,
        po_total_price: parseFloat(item.po_total_price) || 0,
        lead_time: item.lead_time || '',
        due_date: item.due_date || '',
        po_number: item.po_number || '',
        po_status: item.po_status || '',
        supplier_po_status: item.supplier_po_status || null,
        customer_po_status: item.customer_po_status || null,
        order_type: item.order_type || '',
        customer_supplier_name: item.customer_supplier_name || '',
        
        // Delivered data (separated by order_type)
        // Supplier delivered data
        supplier_delivered_quantity: item.supplier_delivered_quantity ? parseFloat(item.supplier_delivered_quantity) : 0,
        supplier_delivered_unit_price: item.supplier_delivered_unit_price ? parseFloat(item.supplier_delivered_unit_price) : 0,
        supplier_delivered_total_price: item.supplier_delivered_total_price ? parseFloat(item.supplier_delivered_total_price) : 0,
        supplier_penalty_percentage: item.supplier_penalty_percentage || null,
        supplier_penalty_amount: item.supplier_penalty_amount ? parseFloat(item.supplier_penalty_amount) : 0,
        supplier_invoice_no: item.supplier_invoice_no || '',
        supplier_balance_quantity_undelivered: item.supplier_balance_quantity_undelivered ? parseFloat(item.supplier_balance_quantity_undelivered) : 0,
        
        // Customer delivered data
        customer_delivered_quantity: item.customer_delivered_quantity ? parseFloat(item.customer_delivered_quantity) : 0,
        customer_delivered_unit_price: item.customer_delivered_unit_price ? parseFloat(item.customer_delivered_unit_price) : 0,
        customer_delivered_total_price: item.customer_delivered_total_price ? parseFloat(item.customer_delivered_total_price) : 0,
        customer_penalty_percentage: item.customer_penalty_percentage || null,
        customer_penalty_amount: item.customer_penalty_amount ? parseFloat(item.customer_penalty_amount) : 0,
        customer_invoice_no: item.customer_invoice_no || '',
        customer_balance_quantity_undelivered: item.customer_balance_quantity_undelivered ? parseFloat(item.customer_balance_quantity_undelivered) : 0,
        
        // Approved quantities (separated by order_type)
        supplier_po_quantity: item.supplier_po_quantity ? parseFloat(item.supplier_po_quantity) : 0,
        supplier_po_unit_price: item.supplier_po_unit_price ? parseFloat(item.supplier_po_unit_price) : 0,
        supplier_po_total_price: item.supplier_po_total_price ? parseFloat(item.supplier_po_total_price) : 0,
        
        customer_po_quantity: item.customer_po_quantity ? parseFloat(item.customer_po_quantity) : 0,
        customer_po_unit_price: item.customer_po_unit_price ? parseFloat(item.customer_po_unit_price) : 0,
        customer_po_total_price: item.customer_po_total_price ? parseFloat(item.customer_po_total_price) : 0,
        
        // Inventory data (if exists - optional)
        inventory_id: item.inventory_id || null,
        inventory_quantity: item.inventory_quantity ? parseFloat(item.inventory_quantity) : 0,
        inventory_unit_price: item.inventory_unit_price ? parseFloat(item.inventory_unit_price) : 0,
        inventory_total_price: item.inventory_total_price ? parseFloat(item.inventory_total_price) : 0,
        inventory_sold_quantity: item.inventory_sold_quantity ? parseFloat(item.inventory_sold_quantity) : 0,
        inventory_balance: item.inventory_balance ? parseFloat(item.inventory_balance) : 0,
        inventory_balance_amount: item.inventory_balance_amount ? parseFloat(item.inventory_balance_amount) : 0,
        
        // Purchase Orders data (grouped by status)
        purchase_orders: {
          approved_orders: approvedOrders,
          delivered_orders: deliveredOrders
        },
        
        // Invoices data
        invoices: {
          purchase_invoices: purchaseInvoices,
          sales_invoices: salesInvoices
        }
      };
    });
    
    // Calculate summary statistics (based on PO items)
    let poTotalQuantity = 0;
    let poTotalValue = 0;
    let inventoryTotalQuantity = 0;
    let inventoryTotalValue = 0;
    let inventoryTotalBalance = 0;
    
    processedItems.forEach(item => {
      // PO item statistics
      poTotalQuantity += parseFloat(item.po_quantity || 0);
      poTotalValue += parseFloat(item.po_total_price || 0);
      
      // Inventory statistics (if inventory exists for this PO item)
      inventoryTotalQuantity += parseFloat(item.inventory_quantity || 0);
      inventoryTotalValue += parseFloat(item.inventory_total_price || 0);
      inventoryTotalBalance += parseFloat(item.inventory_balance || 0);
    });
    
    res.json({
      success: true,
      items: processedItems,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalItems / limitNum),
        totalItems: totalItems,
        itemsPerPage: limitNum
      },
      summary: {
        total_items: totalItems,
        showing_items: processedItems.length,
        po_total_quantity: poTotalQuantity,
        po_total_value: poTotalValue,
        inventory_total_quantity: inventoryTotalQuantity,
        inventory_total_value: inventoryTotalValue,
        inventory_total_balance: inventoryTotalBalance
      }
    });
    
  } catch (error) {
    console.error('Error fetching database dashboard:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching database dashboard',
      error: error.message 
    });
  }
});

// GET /api/database-dashboard/export - Export to CSV
router.get('/export', async (req, res) => {
  try {
    // For simplicity, we'll create a flattened CSV export
    // In production, you might want to use a library like exceljs for better formatting
    
    const { as_of_date, search } = req.query;
    
    // Use the same query structure as the GET endpoint (starting from purchase_order_items)
    // Group by PROJECT NO, PART NO, MATERIAL NO, DESCRIPTION, UOM to avoid duplicates
    let query = `
      SELECT 
        -- Group by these fields to ensure unique items (no duplicates)
        -- Use CASE to match GROUP BY clause exactly (required for ONLY_FULL_GROUP_BY)
        -- This ensures items with different PROJECT NO values appear as separate rows
        CASE WHEN poi.project_no IS NULL THEN CONCAT('__NULL_PROJECT__', poi.id) ELSE poi.project_no END as project_no,
        CASE WHEN poi.part_no IS NULL THEN CONCAT('__NULL_PART__', poi.id) ELSE poi.part_no END as part_no,
        CASE WHEN poi.material_no IS NULL THEN CONCAT('__NULL_MATERIAL__', poi.id) ELSE poi.material_no END as material_no,
        CASE WHEN poi.description IS NULL THEN CONCAT('__NULL_DESC__', poi.id) ELSE poi.description END as description,
        CASE WHEN poi.uom IS NULL THEN CONCAT('__NULL_UOM__', poi.id) ELSE poi.uom END as uom,
        
        -- Aggregate other fields when multiple PO items match the same combination
        MIN(poi.serial_no) as serial_no,
        MIN(DATE_FORMAT(poi.date_po, '%Y-%m-%d')) as date_po,
        
        -- Aggregate approved quantities separately for supplier and customer POs
        SUM(CASE WHEN po.order_type = 'supplier' THEN COALESCE(poi.quantity, 0) ELSE 0 END) as supplier_po_quantity,
        AVG(CASE WHEN po.order_type = 'supplier' THEN COALESCE(poi.unit_price, 0) ELSE NULL END) as supplier_po_unit_price,
        SUM(CASE WHEN po.order_type = 'supplier' THEN COALESCE(poi.total_price, 0) ELSE 0 END) as supplier_po_total_price,
        ANY_VALUE(CASE WHEN po.order_type = 'supplier' THEN poi.lead_time ELSE NULL END) as supplier_lead_time,
        ANY_VALUE(CASE WHEN po.order_type = 'supplier' THEN poi.due_date ELSE NULL END) as supplier_due_date,
        GROUP_CONCAT(DISTINCT CASE WHEN po.order_type = 'supplier' THEN po.po_number ELSE NULL END 
            ORDER BY po.po_number SEPARATOR ', ') as supplier_po_number,
        GROUP_CONCAT(DISTINCT CASE WHEN po.order_type = 'supplier' THEN cs.company_name ELSE NULL END 
            ORDER BY cs.company_name SEPARATOR ', ') as supplier_name,
        
        SUM(CASE WHEN po.order_type = 'customer' THEN COALESCE(poi.quantity, 0) ELSE 0 END) as customer_po_quantity,
        AVG(CASE WHEN po.order_type = 'customer' THEN COALESCE(poi.unit_price, 0) ELSE NULL END) as customer_po_unit_price,
        SUM(CASE WHEN po.order_type = 'customer' THEN COALESCE(poi.total_price, 0) ELSE 0 END) as customer_po_total_price,
        ANY_VALUE(CASE WHEN po.order_type = 'customer' THEN poi.lead_time ELSE NULL END) as customer_lead_time,
        ANY_VALUE(CASE WHEN po.order_type = 'customer' THEN poi.due_date ELSE NULL END) as customer_due_date,
        GROUP_CONCAT(DISTINCT CASE WHEN po.order_type = 'customer' THEN po.po_number ELSE NULL END 
            ORDER BY po.po_number SEPARATOR ', ') as customer_po_number,
        GROUP_CONCAT(DISTINCT CASE WHEN po.order_type = 'customer' THEN cs.company_name ELSE NULL END 
            ORDER BY cs.company_name SEPARATOR ', ') as customer_name,
        
        -- Aggregate delivered quantities separately for supplier and customer POs
        SUM(CASE WHEN po.order_type = 'supplier' THEN COALESCE(poi.delivered_quantity, 0) ELSE 0 END) as supplier_delivered_quantity,
        AVG(CASE WHEN po.order_type = 'supplier' AND poi.delivered_unit_price IS NOT NULL AND poi.delivered_unit_price > 0 
            THEN poi.delivered_unit_price ELSE NULL END) as supplier_delivered_unit_price,
        SUM(CASE WHEN po.order_type = 'supplier' THEN COALESCE(poi.delivered_total_price, 0) ELSE 0 END) as supplier_delivered_total_price,
        MAX(CASE WHEN po.order_type = 'supplier' THEN poi.penalty_percentage ELSE NULL END) as supplier_penalty_percentage,
        SUM(CASE WHEN po.order_type = 'supplier' THEN COALESCE(poi.penalty_amount, 0) ELSE 0 END) as supplier_penalty_amount,
        GROUP_CONCAT(DISTINCT CASE WHEN po.order_type = 'supplier' THEN poi.invoice_no ELSE NULL END 
            ORDER BY poi.invoice_no SEPARATOR ', ') as supplier_invoice_no,
        SUM(CASE WHEN po.order_type = 'supplier' THEN COALESCE(poi.balance_quantity_undelivered, 0) ELSE 0 END) as supplier_balance_quantity_undelivered,
        
        SUM(CASE WHEN po.order_type = 'customer' THEN COALESCE(poi.delivered_quantity, 0) ELSE 0 END) as customer_delivered_quantity,
        AVG(CASE WHEN po.order_type = 'customer' AND poi.delivered_unit_price IS NOT NULL AND poi.delivered_unit_price > 0 
            THEN poi.delivered_unit_price ELSE NULL END) as customer_delivered_unit_price,
        SUM(CASE WHEN po.order_type = 'customer' THEN COALESCE(poi.delivered_total_price, 0) ELSE 0 END) as customer_delivered_total_price,
        MAX(CASE WHEN po.order_type = 'customer' THEN poi.penalty_percentage ELSE NULL END) as customer_penalty_percentage,
        SUM(CASE WHEN po.order_type = 'customer' THEN COALESCE(poi.penalty_amount, 0) ELSE 0 END) as customer_penalty_amount,
        GROUP_CONCAT(DISTINCT CASE WHEN po.order_type = 'customer' THEN poi.invoice_no ELSE NULL END 
            ORDER BY poi.invoice_no SEPARATOR ', ') as customer_invoice_no,
        SUM(CASE WHEN po.order_type = 'customer' THEN COALESCE(poi.balance_quantity_undelivered, 0) ELSE 0 END) as customer_balance_quantity_undelivered,
        
        -- Status: if any PO is delivered, show delivered status
        CASE 
          WHEN SUM(CASE WHEN po.status IN ('partially_delivered', 'delivered_completed') THEN 1 ELSE 0 END) > 0
          THEN MAX(CASE WHEN po.status IN ('partially_delivered', 'delivered_completed') THEN po.status ELSE NULL END)
          ELSE MAX(CASE WHEN po.status = 'approved' THEN 'approved' ELSE NULL END)
        END as po_status
      FROM purchase_order_items poi
      INNER JOIN purchase_orders po 
        ON poi.po_id = po.id
      LEFT JOIN customers_suppliers cs 
        ON po.customer_supplier_id = cs.id
      WHERE po.status IN ('approved', 'partially_delivered', 'delivered_completed')
    `;
    
    let params = [];
    
    if (as_of_date) {
      query += ` AND (DATE(po.created_at) <= ? OR DATE(poi.date_po) <= ?)`;
      params.push(as_of_date, as_of_date);
    }
    
    if (search) {
      query += ` AND (
        poi.serial_no LIKE ? OR 
        poi.project_no LIKE ? OR 
        poi.part_no LIKE ? OR 
        poi.material_no LIKE ? OR 
        poi.description LIKE ? OR
        po.po_number LIKE ?
      )`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
    }
    
    // Group by PROJECT NO, PART NO, MATERIAL NO, DESCRIPTION, UOM to ensure unique items (no duplicates)
    // Use the same CASE logic as the main query
    query += ` 
      GROUP BY 
        CASE WHEN poi.project_no IS NULL THEN CONCAT('__NULL_PROJECT__', poi.id) ELSE poi.project_no END,
        CASE WHEN poi.part_no IS NULL THEN CONCAT('__NULL_PART__', poi.id) ELSE poi.part_no END,
        CASE WHEN poi.material_no IS NULL THEN CONCAT('__NULL_MATERIAL__', poi.id) ELSE poi.material_no END,
        CASE WHEN poi.description IS NULL THEN CONCAT('__NULL_DESC__', poi.id) ELSE poi.description END,
        CASE WHEN poi.uom IS NULL THEN CONCAT('__NULL_UOM__', poi.id) ELSE poi.uom END
      ORDER BY MIN(po.created_at) DESC, MIN(poi.serial_no) ASC`;
    
    const [items] = await req.db.execute(query, params);
    
    // Generate CSV with all columns from dashboard
    // Items are grouped by PROJECT NO, PART NO, MATERIAL NO, DESCRIPTION, UOM (no duplicates)
    const headers = [
      'Serial No', 'Project No', 'Date PO', 'Part No', 'Material No',
      'Description', 'UOM',
      'Approved PO Quantity', 'Approved PO Unit Price', 'Approved PO Total Price', 'Approved PO Lead Time', 'Approved PO Due Date',
      'Delivered Quantity (Supplier)', 'Delivered Unit Price (Supplier)', 'Delivered Total Price (Supplier)', 
      'Penalty % (Supplier)', 'Penalty Amount (Supplier)', 'Supplier Invoice No', 
      'Balance Quantity Undelivered (Supplier)', 'Supplier Name',
      'Approved Sales Quantity', 'Approved Sales Unit Price', 'Approved Sales Total Price', 
      'Approved Sales Lead Time', 'Approved Sales Due Date',
      'Delivered Quantity (Customer)', 'Delivered Unit Price (Customer)', 'Delivered Total Price (Customer)',
      'Penalty % (Customer)', 'Penalty Amount (Customer)', 'Customer Invoice No',
      'Balance Quantity Undelivered (Customer)', 'Customer Name'
    ];
    
    let csv = headers.join(',') + '\n';
    
    items.forEach(item => {
      // Items are already grouped and aggregated by supplier/customer
      // Use the aggregated values directly
      const supplierApproved = {
        quantity: item.supplier_po_quantity || 0,
        unit_price: item.supplier_po_unit_price || 0,
        total_price: item.supplier_po_total_price || 0,
        lead_time: item.supplier_lead_time || '',
        due_date: item.supplier_due_date || '',
        supplier_name: item.supplier_name || '',
        po_number: item.supplier_po_number || ''
      };
      
      const supplierDelivered = {
        delivered_quantity: item.supplier_delivered_quantity || 0,
        delivered_unit_price: item.supplier_delivered_unit_price || 0,
        delivered_total_price: item.supplier_delivered_total_price || 0,
        penalty_percentage: item.supplier_penalty_percentage || '0',
        penalty_amount: item.supplier_penalty_amount || 0,
        invoice_no: item.supplier_invoice_no || '',
        balance_quantity_undelivered: item.supplier_balance_quantity_undelivered || 0,
        supplier_name: item.supplier_name || ''
      };
      
      const customerApproved = {
        quantity: item.customer_po_quantity || 0,
        unit_price: item.customer_po_unit_price || 0,
        total_price: item.customer_po_total_price || 0,
        lead_time: item.customer_lead_time || '',
        due_date: item.customer_due_date || '',
        customer_name: item.customer_name || '',
        po_number: item.customer_po_number || ''
      };
      
      const customerDelivered = {
        delivered_quantity: item.customer_delivered_quantity || 0,
        delivered_unit_price: item.customer_delivered_unit_price || 0,
        delivered_total_price: item.customer_delivered_total_price || 0,
        penalty_percentage: item.customer_penalty_percentage || '0',
        penalty_amount: item.customer_penalty_amount || 0,
        invoice_no: item.customer_invoice_no || '',
        balance_quantity_undelivered: item.customer_balance_quantity_undelivered || 0,
        customer_name: item.customer_name || ''
      };
      
      // Clean up NULL markers before exporting
      const cleanProjectNo = item.project_no && typeof item.project_no === 'string' && item.project_no.startsWith('__NULL_PROJECT__') ? '' : (item.project_no || '');
      const cleanPartNo = item.part_no && typeof item.part_no === 'string' && item.part_no.startsWith('__NULL_PART__') ? '' : (item.part_no || '');
      const cleanMaterialNo = item.material_no && typeof item.material_no === 'string' && item.material_no.startsWith('__NULL_MATERIAL__') ? '' : (item.material_no || '');
      const cleanDescription = item.description && typeof item.description === 'string' && item.description.startsWith('__NULL_DESC__') ? '' : (item.description || '');
      const cleanUom = item.uom && typeof item.uom === 'string' && item.uom.startsWith('__NULL_UOM__') ? '' : (item.uom || '');
      
      const row = [
        item.serial_no || '',
        cleanProjectNo,
        item.date_po || '',
        cleanPartNo,
        cleanMaterialNo,
        `"${cleanDescription.replace(/"/g, '""')}"`,
        cleanUom,
        supplierApproved?.quantity || '',
        supplierApproved?.unit_price || '',
        supplierApproved?.total_price || '',
        supplierApproved?.lead_time || '',
        supplierApproved?.due_date || '',
        supplierDelivered?.delivered_quantity || '',
        supplierDelivered?.delivered_unit_price || '',
        supplierDelivered?.delivered_total_price || '',
        supplierDelivered?.penalty_percentage || '',
        supplierDelivered?.penalty_amount || '',
        supplierDelivered?.invoice_no || '',
        supplierDelivered?.balance_quantity_undelivered || '',
        supplierDelivered?.supplier_name || supplierApproved?.supplier_name || '',
        customerApproved?.quantity || '',
        customerApproved?.unit_price || '',
        customerApproved?.total_price || '',
        customerApproved?.lead_time || '',
        customerApproved?.due_date || '',
        customerDelivered?.delivered_quantity || '',
        customerDelivered?.delivered_unit_price || '',
        customerDelivered?.delivered_total_price || '',
        customerDelivered?.penalty_percentage || '',
        customerDelivered?.penalty_amount || '',
        customerDelivered?.invoice_no || '',
        customerDelivered?.balance_quantity_undelivered || '',
        customerDelivered?.customer_name || customerApproved?.customer_name || ''
      ];
      csv += row.join(',') + '\n';
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=database_dashboard_${Date.now()}.csv`);
    res.send(csv);
    
  } catch (error) {
    console.error('Error exporting dashboard:', error);
    res.status(500).json({ 
      message: 'Error exporting dashboard',
      error: error.message 
    });
  }
});

/**
 * POST /api/database-dashboard/calculate-delivered/:po_id
 * 
 * Calculate and update delivered data for a Purchase Order.
 * 
 * This endpoint recalculates all delivered values from invoices:
 * - delivered_quantity: Sum of quantities from all related invoices
 * - delivered_unit_price: Unit price from any invoice
 * - delivered_total_price: delivered_quantity × delivered_unit_price
 * - penalty_amount: (penalty_percentage × delivered_total_price) / 100
 * - balance_quantity_undelivered: ORDERED QUANTITY - DELIVERED QUANTITY
 * 
 * Invoice Types:
 * - Customer POs: Pull from Sales Tax Invoices
 * - Supplier POs: Pull from Purchase Tax Invoices
 * 
 * This is automatically called when:
 * - Sales/Purchase Tax Invoices are created, updated, or deleted
 * - Purchase Order items are updated (including penalty_percentage changes)
 */
router.post('/calculate-delivered/:po_id', async (req, res) => {
  try {
    const { po_id } = req.params;
    
    // Use the helper function to calculate and update delivered data
    await calculateAndUpdateDeliveredData(req.db, po_id);
    
    res.json({ 
      success: true,
      message: 'Delivered data calculated and updated successfully',
      po_id: po_id
    });
    
  } catch (error) {
    console.error('Error calculating delivered data:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error calculating delivered data',
      error: error.message 
    });
  }
});

// Export the helper function for use in other routes
module.exports = router;
module.exports.calculateAndUpdateDeliveredData = calculateAndUpdateDeliveredData;

