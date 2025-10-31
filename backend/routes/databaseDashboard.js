const express = require('express');
const router = express.Router();

// Helper function to calculate and update delivered data for a PO
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
        // Get data from Purchase Tax Invoices
        const [invoices] = await db.execute(`
          SELECT pti.*, ptii.quantity, ptii.supplier_unit_price, ptii.total_price
          FROM purchase_tax_invoices pti
          INNER JOIN purchase_tax_invoice_items ptii ON pti.id = ptii.invoice_id
          WHERE pti.po_number = ? AND ptii.part_no = ? AND ptii.material_no = ?
        `, [poNumber, item.part_no, item.material_no]);
        
        // Sum quantities and get unit price from any invoice
        for (const inv of invoices) {
          deliveredQuantity += parseFloat(inv.quantity) || 0;
          if (deliveredUnitPrice === null && inv.supplier_unit_price) {
            deliveredUnitPrice = parseFloat(inv.supplier_unit_price);
          }
          if (inv.invoice_number) {
            invoiceNumbers.push(inv.invoice_number);
          }
        }
      } else {
        // Get data from Sales Tax Invoices
        const [invoices] = await db.execute(`
          SELECT sti.*, stii.quantity, stii.unit_price, stii.total_amount
          FROM sales_tax_invoices sti
          INNER JOIN sales_tax_invoice_items stii ON sti.id = stii.invoice_id
          WHERE sti.customer_po_number = ? AND stii.part_no = ? AND stii.material_no = ?
        `, [poNumber, item.part_no, item.material_no]);
        
        // Sum quantities and get unit price from any invoice
        for (const inv of invoices) {
          deliveredQuantity += parseFloat(inv.quantity) || 0;
          if (deliveredUnitPrice === null && inv.unit_price) {
            deliveredUnitPrice = parseFloat(inv.unit_price);
          }
          if (inv.invoice_number) {
            invoiceNumbers.push(inv.invoice_number);
          }
        }
      }
      
      // Calculate delivered_total_price
      const deliveredTotalPrice = deliveredQuantity * deliveredUnitPrice || 0;
      
      // Get or keep penalty_percentage
      const penaltyPercentage = item.penalty_percentage || null;
      
      // Calculate penalty_amount
      let penaltyAmount = null;
      if (penaltyPercentage && deliveredTotalPrice) {
        penaltyAmount = (penaltyPercentage * deliveredTotalPrice) / 100;
      }
      
      // Calculate balance_quantity_undelivered
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
    const [updatedItems] = await db.execute(
      'SELECT quantity, delivered_quantity FROM purchase_order_items WHERE po_id = ?',
      [poId]
    );
    
    let allDelivered = true;
    let allPending = true;
    
    for (const itm of updatedItems) {
      const qty = parseFloat(itm.quantity) || 0;
      const delQty = parseFloat(itm.delivered_quantity) || 0;
      
      if (delQty > 0 && delQty < qty) {
        allDelivered = false;
        allPending = false;
      } else if (delQty === 0) {
        allDelivered = false;
      } else if (delQty >= qty) {
        allPending = false;
      }
    }
    
    // Set appropriate status
    let newStatus = po.status;
    if (allDelivered && !allPending) {
      newStatus = 'delivered_completed';
    } else if (!allPending && !allDelivered) {
      newStatus = 'partially_delivered';
    }
    
    // Only update if status changed and newStatus is valid
    if (newStatus !== po.status && ['approved', 'partially_delivered', 'delivered_completed'].includes(newStatus)) {
      await db.execute('UPDATE purchase_orders SET status = ? WHERE id = ?', [newStatus, poId]);
      console.log(`✓ Updated PO ${poId} status to ${newStatus}`);
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
        
        -- Approved Orders (all types with status = 'approved')
        GROUP_CONCAT(DISTINCT CASE 
          WHEN po_approved.status = 'approved'
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
            COALESCE(po_approved.order_type, '')
          )
          ELSE NULL 
        END SEPARATOR '||') as approved_orders_data,
        
        -- Delivered Purchase Orders (all types with status = 'partially_delivered' or 'delivered_completed')
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
            COALESCE(poi_delivered.penalty_percentage, ''), '|',
            COALESCE(poi_delivered.penalty_amount, ''), '|',
            COALESCE(poi_delivered.invoice_no, ''), '|',
            COALESCE(poi_delivered.balance_quantity_undelivered, ''), '|',
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
      // Parse approved orders (all types)
      const approvedOrders = item.approved_orders_data
        ? item.approved_orders_data.split('||').map(data => {
            const [quantity, unit_price, total_price, lead_time, due_date, supplier_name, po_number, order_type] = data.split('|');
            return {
              quantity: parseFloat(quantity) || 0,
              unit_price: parseFloat(unit_price) || 0,
              total_price: parseFloat(total_price) || 0,
              lead_time: lead_time || '',
              due_date: due_date || '',
              supplier_name: supplier_name || '',
              po_number: po_number || '',
              order_type: order_type || ''
            };
          })
        : [];
      
      // Parse delivered orders (all types)
      const deliveredOrders = item.delivered_orders_data
        ? item.delivered_orders_data.split('||').map(data => {
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
              penalty_percentage: parts[8] || '',
              penalty_amount: parts[9] || '',
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
        GROUP_CONCAT(DISTINCT CASE 
          WHEN po_approved.status = 'approved'
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
            COALESCE(po_approved.order_type, '')
          )
          ELSE NULL 
        END SEPARATOR '||') as approved_orders_data,
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
            COALESCE(poi_delivered.penalty_percentage, ''), '|',
            COALESCE(poi_delivered.penalty_amount, ''), '|',
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

// POST /api/database-dashboard/calculate-delivered - Calculate delivered data from invoices
router.post('/calculate-delivered/:po_id', async (req, res) => {
  try {
    const { po_id } = req.params;
    
    // Get the Purchase Order
    const [pos] = await req.db.execute(
      'SELECT * FROM purchase_orders WHERE id = ?',
      [po_id]
    );
    
    if (pos.length === 0) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }
    
    const po = pos[0];
    const isSupplier = po.order_type === 'supplier';
    
    // Get all items for this PO
    const [items] = await req.db.execute(
      'SELECT * FROM purchase_order_items WHERE po_id = ?',
      [po_id]
    );
    
    // For each item, calculate delivered data from invoices
    for (const item of items) {
      let deliveredQuantity = 0;
      let deliveredUnitPrice = null;
      let invoiceNumbers = [];
      
      if (isSupplier) {
        // Get data from Purchase Tax Invoices
        const [invoices] = await req.db.execute(`
          SELECT pti.*, ptii.quantity, ptii.supplier_unit_price, ptii.total_price
          FROM purchase_tax_invoices pti
          INNER JOIN purchase_tax_invoice_items ptii ON pti.id = ptii.invoice_id
          WHERE pti.po_number = ? AND ptii.part_no = ? AND ptii.material_no = ?
        `, [po.po_number, item.part_no, item.material_no]);
        
        // Sum quantities and get unit price from any invoice
        for (const inv of invoices) {
          deliveredQuantity += parseFloat(inv.quantity) || 0;
          if (deliveredUnitPrice === null && inv.supplier_unit_price) {
            deliveredUnitPrice = parseFloat(inv.supplier_unit_price);
          }
          if (inv.invoice_number) {
            invoiceNumbers.push(inv.invoice_number);
          }
        }
      } else {
        // Get data from Sales Tax Invoices
        const [invoices] = await req.db.execute(`
          SELECT sti.*, stii.quantity, stii.unit_price, stii.total_amount
          FROM sales_tax_invoices sti
          INNER JOIN sales_tax_invoice_items stii ON sti.id = stii.invoice_id
          WHERE sti.po_number = ? AND stii.part_no = ? AND stii.material_no = ?
        `, [po.po_number, item.part_no, item.material_no]);
        
        // Sum quantities and get unit price from any invoice
        for (const inv of invoices) {
          deliveredQuantity += parseFloat(inv.quantity) || 0;
          if (deliveredUnitPrice === null && inv.unit_price) {
            deliveredUnitPrice = parseFloat(inv.unit_price);
          }
          if (inv.invoice_number) {
            invoiceNumbers.push(inv.invoice_number);
          }
        }
      }
      
      // Calculate delivered_total_price
      const deliveredTotalPrice = deliveredQuantity * deliveredUnitPrice || 0;
      
      // Get or keep penalty_percentage
      const penaltyPercentage = item.penalty_percentage || null;
      
      // Calculate penalty_amount
      let penaltyAmount = null;
      if (penaltyPercentage && deliveredTotalPrice) {
        penaltyAmount = (penaltyPercentage * deliveredTotalPrice) / 100;
      }
      
      // Calculate balance_quantity_undelivered
      const balanceQuantityUndelivered = (parseFloat(item.quantity) || 0) - deliveredQuantity;
      
      // Update the item
      await req.db.execute(`
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
        invoiceNumbers.join(', '),
        item.id
      ]);
    }
    
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

