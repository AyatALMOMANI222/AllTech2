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
    
    // Base query to get all inventory items with related purchase and sales data
    let query = `
      SELECT 
        i.id as inventory_id,
        i.serial_no,
        i.project_no,
        i.date_po,
        i.part_no,
        i.material_no,
        i.description,
        i.uom,
        i.quantity as inventory_quantity,
        i.supplier_unit_price as inventory_unit_price,
        i.total_price as inventory_total_price,
        i.sold_quantity as inventory_sold_quantity,
        i.balance as inventory_balance,
        i.balance_amount as inventory_balance_amount,
        
        -- Approved Orders (status = 'approved', 'partially_delivered', or 'delivered_completed')
        -- Shows all POs that were approved, including those that have been delivered
        -- NOTE: Delivered POs appear in BOTH approved and delivered sections
        GROUP_CONCAT(DISTINCT CASE 
          WHEN po_approved.status IN ('approved', 'partially_delivered', 'delivered_completed')
          THEN CONCAT(
            poi_approved.quantity, '|',
            poi_approved.unit_price, '|',
            (poi_approved.quantity * poi_approved.unit_price), '|',
            COALESCE(poi_approved.lead_time, ''), '|',
            COALESCE(poi_approved.due_date, ''), '|',
            COALESCE(cs_approved.company_name, ''),
            '|',
            COALESCE(po_approved.po_number, ''),
            '|',
            COALESCE(po_approved.order_type, ''),
            '|',
            COALESCE(po_approved.status, '')
          )
          ELSE NULL 
        END SEPARATOR '||') as approved_orders_data,
        
        -- 📦 DELIVERED PURCHASED ORDER Section
        -- ⚠️ Display Condition: Show ONLY when PO status is "partially_delivered" or "delivered_completed"
        -- ⚠️ IMPORTANT: Records are displayed REGARDLESS of penalty_percentage or penalty_amount values
        -- Records appear immediately when status changes to partially_delivered or delivered_completed
        -- NOTE: These POs ALSO appear in the APPROVED section above (showing original approved data)
        -- A PO appears in BOTH sections when it becomes delivered - it is NOT removed from approved section
        -- Data Structure (pipe-separated):
        -- [0] quantity (ORDERED QUANTITY from APPROVED section)
        -- [1] unit_price (original unit price)
        -- [2] total_price (ORDERED QUANTITY × unit_price)
        -- [3] lead_time
        -- [4] due_date
        -- [5] delivered_quantity (sum from all invoices)
        -- [6] delivered_unit_price (from any invoice)
        -- [7] delivered_total_price (delivered_quantity × delivered_unit_price)
        -- [8] penalty_percentage (can be empty/null - does NOT affect display)
        -- [9] penalty_amount (can be empty/null - does NOT affect display)
        -- [10] invoice_no (comma-separated invoice numbers)
        -- [11] balance_quantity_undelivered (ORDERED QUANTITY - DELIVERED QUANTITY)
        -- [12] company_name
        -- [13] po_number
        -- [14] order_type
        -- [15] status
        -- ⚠️ CRITICAL: Display condition is ONLY based on status, NOT on penalty_percentage or any other field
        -- Records are included if status === 'partially_delivered' OR status === 'delivered_completed'
        -- This works even if penalty_percentage, penalty_amount, or delivered_quantity are NULL/empty
        -- ⚠️ IMPORTANT: Records appear immediately when status changes to partially_delivered or delivered_completed
        -- ⚠️ Records are displayed REGARDLESS of penalty_percentage value (NULL, empty string, or any value)
        -- ⚠️ The only condition is the PO status - penalty_percentage does NOT affect whether records appear
        GROUP_CONCAT(DISTINCT CASE 
          WHEN po_delivered.status IN ('partially_delivered', 'delivered_completed')
          THEN CONCAT(
            poi_delivered.quantity, '|',                    -- ORDERED QUANTITY (from APPROVED section)
            poi_delivered.unit_price, '|',                  -- Original unit price
            (poi_delivered.quantity * poi_delivered.unit_price), '|',  -- Original total
            COALESCE(poi_delivered.lead_time, ''), '|',
            COALESCE(poi_delivered.due_date, ''), '|',
            COALESCE(poi_delivered.delivered_quantity, ''), '|',       -- DELIVERED QUANTITY (sum from invoices)
            COALESCE(poi_delivered.delivered_unit_price, ''), '|',     -- DELIVERED UNIT PRICE (from invoices)
            COALESCE(poi_delivered.delivered_total_price, ''), '|',    -- DELIVERED TOTAL PRICE (calculated)
            COALESCE(NULLIF(poi_delivered.penalty_percentage, ''), '0'), '|',  -- PENALTY % (convert empty/null to '0' - does NOT affect display)
            COALESCE(NULLIF(poi_delivered.penalty_amount, ''), '0'), '|',      -- PENALTY AMOUNT (convert empty/null to '0' - does NOT affect display)
            COALESCE(poi_delivered.invoice_no, ''), '|',               -- Invoice numbers
            COALESCE(poi_delivered.balance_quantity_undelivered, ''), '|',  -- BALANCE (ORDERED - DELIVERED)
            COALESCE(cs_delivered.company_name, ''),
            '|',
            COALESCE(po_delivered.po_number, ''),
            '|',
            COALESCE(po_delivered.order_type, ''),
            '|',
            COALESCE(po_delivered.status, '')
          )
          ELSE NULL 
        END SEPARATOR '||') as delivered_orders_data,
        
        -- Purchase Tax Invoice data
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
        
        -- Sales Tax Invoice data
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
        
      FROM inventory i
      
      -- Join with Purchase Orders for approved status - Match by part_no, material_no
      LEFT JOIN purchase_order_items poi_approved 
        ON i.part_no = poi_approved.part_no 
        AND (i.material_no = poi_approved.material_no OR (i.material_no IS NULL AND poi_approved.material_no IS NULL))
      LEFT JOIN purchase_orders po_approved 
        ON poi_approved.po_id = po_approved.id
      LEFT JOIN customers_suppliers cs_approved 
        ON po_approved.customer_supplier_id = cs_approved.id
      
      -- Join with Purchase Orders for delivered status - Match by part_no, material_no
      LEFT JOIN purchase_order_items poi_delivered 
        ON i.part_no = poi_delivered.part_no 
        AND (i.material_no = poi_delivered.material_no OR (i.material_no IS NULL AND poi_delivered.material_no IS NULL))
      LEFT JOIN purchase_orders po_delivered 
        ON poi_delivered.po_id = po_delivered.id
      LEFT JOIN customers_suppliers cs_delivered 
        ON po_delivered.customer_supplier_id = cs_delivered.id
      
      -- Join with Purchase Tax Invoices - Match by part_no, material_no
      LEFT JOIN purchase_tax_invoice_items ptii
        ON i.part_no = ptii.part_no 
        AND (i.material_no = ptii.material_no OR (i.material_no IS NULL AND ptii.material_no IS NULL))
      LEFT JOIN purchase_tax_invoices pti
        ON ptii.invoice_id = pti.id
      LEFT JOIN customers_suppliers cs_pti_supplier
        ON pti.supplier_id = cs_pti_supplier.id
      
      -- Join with Sales Tax Invoices - Match by part_no, material_no
      LEFT JOIN sales_tax_invoice_items stii
        ON i.part_no = stii.part_no 
        AND (i.material_no = stii.material_no OR (i.material_no IS NULL AND stii.material_no IS NULL))
      LEFT JOIN sales_tax_invoices sti
        ON stii.invoice_id = sti.id
      LEFT JOIN customers_suppliers cs_sti_customer
        ON sti.customer_id = cs_sti_customer.id
      
      WHERE 1=1
    `;
    
    let params = [];
    
    // Add date filter if provided
    if (as_of_date) {
      query += ` AND DATE(i.created_at) <= ?`;
      params.push(as_of_date);
    }
    
    // Add search filter
    if (search) {
      query += ` AND (
        i.serial_no LIKE ? OR 
        i.project_no LIKE ? OR 
        i.part_no LIKE ? OR 
        i.material_no LIKE ? OR 
        i.description LIKE ?
      )`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }
    
    query += ` GROUP BY i.id ORDER BY i.serial_no ASC, i.created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;
    
    const [items] = await req.db.execute(query, params);
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(DISTINCT i.id) as total
      FROM inventory i
      WHERE 1=1
    `;
    
    const countParams = [];
    
    if (as_of_date) {
      countQuery += ` AND DATE(i.created_at) <= ?`;
      countParams.push(as_of_date);
    }
    
    if (search) {
      countQuery += ` AND (
        i.serial_no LIKE ? OR 
        i.project_no LIKE ? OR 
        i.part_no LIKE ? OR 
        i.material_no LIKE ? OR 
        i.description LIKE ?
      )`;
      const searchParam = `%${search}%`;
      countParams.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }
    
    const [countResult] = await req.db.execute(countQuery, countParams);
    const totalItems = countResult[0].total;
    
    // Process the concatenated data into structured format
    const processedItems = items.map(item => {
      // Parse approved orders (status = 'approved', 'partially_delivered', or 'delivered_completed')
      // NOTE: Delivered POs appear in BOTH approved and delivered sections
      const approvedOrders = item.approved_orders_data
        ? item.approved_orders_data.split('||').filter(data => data && data.trim() !== '').map(data => {
            const parts = data.split('|');
            return {
              quantity: parseFloat(parts[0]) || 0,
              unit_price: parseFloat(parts[1]) || 0,
              total_price: parseFloat(parts[2]) || 0,
              lead_time: parts[3] || '',
              due_date: parts[4] || '',
              supplier_name: parts[5] || '',
              po_number: parts[6] || '',
              order_type: parts[7] || '',
              status: parts[8] || 'approved'
            };
          })
        : [];
      
      // Parse delivered orders (status = 'partially_delivered' or 'delivered_completed')
      // ⚠️ IMPORTANT: Records are included regardless of penalty_percentage value (can be empty/null)
      // ⚠️ Records appear when PO status is 'partially_delivered' or 'delivered_completed'
      // ⚠️ This happens automatically when an invoice is created (Sales or Purchase Tax Invoice)
      // ⚠️ Records are displayed for BOTH supplier and customer orders
      // ⚠️ CRITICAL: penalty_percentage being empty/null does NOT prevent records from appearing
      // ⚠️ The only condition for display is PO status, NOT penalty_percentage or any other field
      // ⚠️ NOTE: These POs ALSO appear in the APPROVED section above - they are NOT removed from approved section
      const deliveredOrders = item.delivered_orders_data
        ? item.delivered_orders_data.split('||').filter(data => data && data.trim() !== '').map(data => {
            const parts = data.split('|');
            return {
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
            };
          })
        : [];
      
      // Parse purchase invoices
      const purchaseInvoices = item.purchase_invoice_data
        ? item.purchase_invoice_data.split('||').map(data => {
            const [quantity, unit_price, total_price, invoice_no, supplier_name] = data.split('|');
            return {
              quantity: parseFloat(quantity) || 0,
              unit_price: parseFloat(unit_price) || 0,
              total_price: parseFloat(total_price) || 0,
              invoice_no: invoice_no || '',
              supplier_name: supplier_name || ''
            };
          })
        : [];
      
      // Parse sales invoices
      const salesInvoices = item.sales_invoice_data
        ? item.sales_invoice_data.split('||').map(data => {
            const [quantity, unit_price, total_price, invoice_no, customer_name] = data.split('|');
            return {
              quantity: parseFloat(quantity) || 0,
              unit_price: parseFloat(unit_price) || 0,
              total_price: parseFloat(total_price) || 0,
              invoice_no: invoice_no || '',
              customer_name: customer_name || ''
            };
          })
        : [];
      
      return {
        // Inventory base data
        id: item.inventory_id,
        serial_no: item.serial_no,
        project_no: item.project_no,
        date_po: item.date_po,
        part_no: item.part_no,
        material_no: item.material_no,
        description: item.description,
        uom: item.uom,
        inventory_quantity: parseFloat(item.inventory_quantity) || 0,
        inventory_unit_price: parseFloat(item.inventory_unit_price) || 0,
        inventory_total_price: parseFloat(item.inventory_total_price) || 0,
        inventory_sold_quantity: parseFloat(item.inventory_sold_quantity) || 0,
        inventory_balance: parseFloat(item.inventory_balance) || 0,
        inventory_balance_amount: parseFloat(item.inventory_balance_amount) || 0,
        
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
    
    // Calculate summary statistics
    let inventoryTotalQuantity = 0;
    let inventoryTotalValue = 0;
    let inventoryTotalBalance = 0;
    
    processedItems.forEach(item => {
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
        total_quantity: inventoryTotalQuantity,
        total_value: inventoryTotalValue,
        total_balance: inventoryTotalBalance
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
    
    // Use the same comprehensive query as the GET endpoint
    let query = `
      SELECT 
        i.serial_no,
        i.project_no,
        DATE_FORMAT(i.date_po, '%Y-%m-%d') as date_po,
        i.part_no,
        i.material_no,
        i.description,
        i.uom,
        i.quantity,
        i.supplier_unit_price,
        i.total_price,
        i.sold_quantity,
        i.balance,
        i.balance_amount,
        -- Approved Orders (status = 'approved', 'partially_delivered', or 'delivered_completed')
        -- Shows all POs that were approved, including those that have been delivered
        -- NOTE: Delivered POs appear in BOTH approved and delivered sections
        GROUP_CONCAT(DISTINCT CASE 
          WHEN po_approved.status IN ('approved', 'partially_delivered', 'delivered_completed')
          THEN CONCAT(
            poi_approved.quantity, '|',
            poi_approved.unit_price, '|',
            (poi_approved.quantity * poi_approved.unit_price), '|',
            COALESCE(poi_approved.lead_time, ''), '|',
            COALESCE(poi_approved.due_date, ''), '|',
            COALESCE(cs_approved.company_name, ''),
            '|',
            COALESCE(po_approved.po_number, ''),
            '|',
            COALESCE(po_approved.order_type, ''),
            '|',
            COALESCE(po_approved.status, '')
          )
          ELSE NULL 
        END SEPARATOR '||') as approved_orders_data,
        -- Delivered Orders (only partially_delivered or delivered_completed)
        -- ⚠️ CRITICAL: Display condition is ONLY based on status, NOT on penalty_percentage or any other field
        -- Records are included if status === 'partially_delivered' OR status === 'delivered_completed'
        -- This works even if penalty_percentage, penalty_amount, or delivered_quantity are NULL/empty
        -- NOTE: These POs ALSO appear in the APPROVED section above - they are NOT removed from approved section
        GROUP_CONCAT(DISTINCT CASE 
          WHEN po_delivered.status IN ('partially_delivered', 'delivered_completed')
          THEN CONCAT(
            poi_delivered.quantity, '|',
            poi_delivered.unit_price, '|',
            (poi_delivered.quantity * poi_delivered.unit_price), '|',
            COALESCE(poi_delivered.lead_time, ''), '|',
            COALESCE(poi_delivered.due_date, ''), '|',
            COALESCE(poi_delivered.delivered_quantity, ''), '|',
            COALESCE(poi_delivered.delivered_unit_price, ''), '|',
            COALESCE(poi_delivered.delivered_total_price, ''), '|',
            COALESCE(NULLIF(poi_delivered.penalty_percentage, ''), '0'), '|',
            COALESCE(NULLIF(poi_delivered.penalty_amount, ''), '0'), '|',
            COALESCE(poi_delivered.invoice_no, ''), '|',
            COALESCE(poi_delivered.balance_quantity_undelivered, ''), '|',
            COALESCE(cs_delivered.company_name, ''),
            '|',
            COALESCE(po_delivered.po_number, ''),
            '|',
            COALESCE(po_delivered.order_type, '')
          )
          ELSE NULL 
        END SEPARATOR '||') as delivered_orders_data
      FROM inventory i
      LEFT JOIN purchase_order_items poi_approved 
        ON i.part_no = poi_approved.part_no 
        AND (i.material_no = poi_approved.material_no OR (i.material_no IS NULL AND poi_approved.material_no IS NULL))
      LEFT JOIN purchase_orders po_approved 
        ON poi_approved.po_id = po_approved.id
      LEFT JOIN customers_suppliers cs_approved 
        ON po_approved.customer_supplier_id = cs_approved.id
      LEFT JOIN purchase_order_items poi_delivered 
        ON i.part_no = poi_delivered.part_no 
        AND (i.material_no = poi_delivered.material_no OR (i.material_no IS NULL AND poi_delivered.material_no IS NULL))
      LEFT JOIN purchase_orders po_delivered
        ON poi_delivered.po_id = po_delivered.id
      LEFT JOIN customers_suppliers cs_delivered 
        ON po_delivered.customer_supplier_id = cs_delivered.id
      WHERE 1=1
    `;
    
    let params = [];
    
    if (as_of_date) {
      query += ` AND DATE(i.created_at) <= ?`;
      params.push(as_of_date);
    }
    
    if (search) {
      query += ` AND (
        i.serial_no LIKE ? OR 
        i.project_no LIKE ? OR 
        i.part_no LIKE ? OR 
        i.material_no LIKE ? OR 
        i.description LIKE ?
      )`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }
    
    query += ` GROUP BY i.id ORDER BY i.serial_no ASC`;
    
    const [items] = await req.db.execute(query, params);
    
    // Helper to parse grouped orders data
    const parseOrdersData = (data) => {
      if (!data) return [];
      return data.split('||').map(order => {
        const parts = order.split('|');
        return {
          quantity: parts[0] || '',
          unit_price: parts[1] || '',
          total_price: parts[2] || '',
          lead_time: parts[3] || '',
          due_date: parts[4] || '',
          customer_supplier_name: parts[5] || '',
          order_type: parts[7] || '',
          delivered_quantity: parts[8] || '',
          delivered_unit_price: parts[9] || '',
          delivered_total_price: parts[10] || '',
          penalty_percentage: parts[11] || '',
          penalty_amount: parts[12] || '',
          invoice_no: parts[13] || '',
          balance_quantity_undelivered: parts[14] || ''
        };
      });
    };
    
    // Generate CSV with all 31 columns from dashboard
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
      const approvedOrders = parseOrdersData(item.approved_orders_data);
      const deliveredOrders = parseOrdersData(item.delivered_orders_data);
      
      const supplierApproved = approvedOrders.find(o => o.order_type === 'supplier');
      const customerApproved = approvedOrders.find(o => o.order_type === 'customer');
      const supplierDelivered = deliveredOrders.find(o => o.order_type === 'supplier');
      const customerDelivered = deliveredOrders.find(o => o.order_type === 'customer');
      
      const row = [
        item.serial_no || '',
        item.project_no || '',
        item.date_po || '',
        item.part_no || '',
        item.material_no || '',
        `"${(item.description || '').replace(/"/g, '""')}"`,
        item.uom || '',
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
        supplierDelivered?.customer_supplier_name || '',
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
        customerDelivered?.customer_supplier_name || ''
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

