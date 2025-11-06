const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { calculateAndUpdateDeliveredData } = require('./databaseDashboard');
const puppeteer = require('puppeteer');
const path = require('path');

const router = express.Router();

// Validation middleware
const validatePurchaseTaxInvoice = [
  body('invoice_number').notEmpty().withMessage('Invoice Number is required'),
  body('invoice_date').isISO8601().withMessage('Valid invoice date is required'),
  body('supplier_id').notEmpty().withMessage('Supplier is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required')
];

// GET /api/purchase-tax-invoices - Get all purchase tax invoices
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, supplier_id, po_number } = req.query;
    
    let query = `
      SELECT pti.*, 
             cs.company_name as supplier_name,
             cs.address as supplier_address,
             cs.contact_person as supplier_contact,
             cs.email as supplier_email,
             cs.phone as supplier_phone,
             u.username as created_by_name
      FROM purchase_tax_invoices pti
      LEFT JOIN customers_suppliers cs ON pti.supplier_id = cs.id
      LEFT JOIN users u ON pti.created_by = u.id
    `;
    
    let countQuery = 'SELECT COUNT(*) as total FROM purchase_tax_invoices pti';
    let params = [];
    let conditions = [];
    
    if (supplier_id) {
      conditions.push('pti.supplier_id = ?');
      params.push(supplier_id);
    }
    
    if (po_number) {
      conditions.push('pti.po_number = ?');
      params.push(po_number);
    }
    
    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }
    
    query += ' ORDER BY pti.created_at DESC';
    
    const offset = (page - 1) * limit;
    query += ` LIMIT ${limit} OFFSET ${offset}`;
    
    const [invoices] = await req.db.execute(query, params);
    const [countResult] = await req.db.execute(countQuery, params);
    const total = countResult[0].total;
    
    res.json({
      invoices,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching purchase tax invoices:', error);
    res.status(500).json({ message: 'Error fetching purchase tax invoices' });
  }
});

// GET /api/purchase-tax-invoices/:id - Get single purchase tax invoice with items
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get invoice details
    const [invoices] = await req.db.execute(`
      SELECT pti.*, 
             cs.company_name as supplier_name,
             cs.address as supplier_address,
             cs.contact_person as supplier_contact,
             cs.email as supplier_email,
             cs.phone as supplier_phone,
             cs.trn_number as supplier_trn,
             u.username as created_by_name
      FROM purchase_tax_invoices pti
      LEFT JOIN customers_suppliers cs ON pti.supplier_id = cs.id
      LEFT JOIN users u ON pti.created_by = u.id
      WHERE pti.id = ?
    `, [id]);
    
    if (invoices.length === 0) {
      return res.status(404).json({ message: 'Purchase tax invoice not found' });
    }
    
    // Get invoice items
    const [items] = await req.db.execute(`
      SELECT * FROM purchase_tax_invoice_items 
      WHERE invoice_id = ? 
      ORDER BY serial_no
    `, [id]);
    
    res.json({
      invoice: invoices[0],
      items
    });
  } catch (error) {
    console.error('Error fetching purchase tax invoice:', error);
    res.status(500).json({ message: 'Error fetching purchase tax invoice' });
  }
});

// POST /api/purchase-tax-invoices - Create new purchase tax invoice
router.post('/', authenticateToken, validatePurchaseTaxInvoice, async (req, res) => {
  const connection = await req.db.getConnection();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const {
      invoice_number,
      invoice_date,
      supplier_id,
      po_number,
      project_number,
      claim_percentage = 100,
      amount_paid = 0,
      items = []
    } = req.body;
    
    // Start transaction
    await connection.beginTransaction();
    
    // Calculate totals according to specifications
    let subtotal = 0;
    for (const item of items) {
      const itemTotal = parseFloat(item.quantity) * parseFloat(item.supplier_unit_price);
      subtotal += itemTotal;
    }
    
    // Amount of Claim = Subtotal × %
    const claimPercentage = parseFloat(claim_percentage) || 100;
    const amountOfClaim = subtotal * (claimPercentage / 100);
    
    // VAT (5%) = Amount of Claim × 5%
    const vatAmount = amountOfClaim * 0.05;
    
    // Gross Total = Amount of Claim + VAT
    const grossTotal = amountOfClaim + vatAmount;
    
    // Create invoice
    const createdBy = req.user?.id || null;
    const [result] = await connection.execute(`
      INSERT INTO purchase_tax_invoices (
        invoice_number, invoice_date, supplier_id, po_number, project_number,
        claim_percentage, subtotal, vat_amount, gross_total, amount_paid, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      invoice_number, invoice_date, supplier_id, po_number, project_number,
      claim_percentage, subtotal, vatAmount, grossTotal, amount_paid, createdBy
    ]);
    
    const invoiceId = result.insertId;
    
    // Add items and update inventory
    for (const item of items) {
      const itemTotal = parseFloat(item.quantity) * parseFloat(item.supplier_unit_price);
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.supplier_unit_price) || 0;
      
      // Insert invoice item
      await connection.execute(`
        INSERT INTO purchase_tax_invoice_items (
          invoice_id, serial_no, project_no, part_no, material_no,
          description, uom, quantity, supplier_unit_price, total_price
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        invoiceId, item.serial_no, item.project_no, item.part_no, item.material_no,
        item.description, item.uom, quantity, unitPrice, itemTotal
      ]);
      
      // Update inventory - match by project_no, part_no, description, AND supplier_unit_price
      // ⚠️ IMPORTANT: Only update existing inventory if ALL four fields match exactly
      // If any field differs (including project_no), create a new inventory record
      if (item.part_no && item.description) {
        // Determine the project_no to use for matching (from item or fallback to invoice project_number)
        const projectNoForMatching = item.project_no || project_number || null;
        
        // Check if inventory item exists - match by project_no, part_no, description, AND supplier_unit_price
        // ⚠️ CRITICAL: All four fields (project_no, part_no, description, supplier_unit_price) must match exactly
        // Handle NULL values correctly: use IS NULL when comparing NULL, otherwise use equality
        let existingItems;
        if (projectNoForMatching === null || projectNoForMatching === '') {
          // If project_no is NULL/empty, match only records with NULL/empty project_no
          [existingItems] = await connection.execute(`
          SELECT id, quantity, sold_quantity, supplier_unit_price
          FROM inventory 
            WHERE (project_no IS NULL OR project_no = '')
              AND part_no = ? 
              AND description = ? 
              AND supplier_unit_price = ?
          `, [
            item.part_no,
            item.description,
            unitPrice
          ]);
        } else {
          // If project_no has a value, match records with the exact same project_no value
          [existingItems] = await connection.execute(`
            SELECT id, quantity, sold_quantity, supplier_unit_price
            FROM inventory 
            WHERE project_no = ?
              AND part_no = ? 
              AND description = ? 
              AND supplier_unit_price = ?
          `, [
            projectNoForMatching,
            item.part_no,
            item.description,
            unitPrice
          ]);
        }
        
        if (existingItems.length > 0) {
          // Item exists with exact match on all four fields - UPDATE quantities and recalculate
          // Update only ONE existing inventory record (first match)
          const existingItem = existingItems[0];
          const newQuantity = parseFloat(existingItem.quantity) + quantity;
          const soldQuantity = parseFloat(existingItem.sold_quantity) || 0;
          const balance = newQuantity - soldQuantity;
          const totalPrice = newQuantity * unitPrice;
          const balanceAmount = balance * unitPrice;
          
          await connection.execute(`
          UPDATE inventory 
            SET quantity = ?,
                supplier_unit_price = ?,
                total_price = ?,
                balance = ?,
                balance_amount = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [
            newQuantity,
            unitPrice,
            totalPrice,
            balance,
            balanceAmount,
            existingItem.id
          ]);
          
          console.log(`Updated existing inventory: project_no=${item.project_no || project_number}, part_no=${item.part_no}, description=${item.description}, unit_price=${unitPrice}, new_quantity=${newQuantity}`);
        } else {
          // No exact match found - CREATE new inventory record
          // This happens when any of the key fields differ (project_no, part_no, description, or supplier_unit_price)
          const balance = quantity; // balance = quantity - sold_quantity (0)
          const totalPrice = quantity * unitPrice;
          const balanceAmount = balance * unitPrice;
          
          await connection.execute(`
            INSERT INTO inventory (
              serial_no, project_no, date_po, part_no, material_no, description,
              uom, quantity, supplier_unit_price, total_price, sold_quantity,
              balance, balance_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            item.serial_no,
            item.project_no || project_number,
            invoice_date, // Use invoice date as date_po
            item.part_no,
            item.material_no,
            item.description,
            item.uom,
            quantity,
            unitPrice,
            totalPrice,
            0, // sold_quantity starts at 0
            balance,
            balanceAmount
          ]);
          
          console.log(`Created new inventory record: project_no=${item.project_no || project_number}, part_no=${item.part_no}, description=${item.description}, unit_price=${unitPrice}`);
        }
      }
    }
    
    // Commit transaction
    await connection.commit();
    
    // Recalculate delivered data for the PO if exists
    if (po_number) {
      const [pos] = await connection.execute(
        'SELECT id FROM purchase_orders WHERE po_number = ?',
        [po_number]
      );
      if (pos.length > 0) {
        // ⚠️ AUTOMATIC TRIGGER: Recalculate delivered data for the PO
        // This ensures delivered_quantity, delivered_unit_price, delivered_total_price,
        // penalty_amount, and balance_quantity_undelivered are updated from invoice data
        await calculateAndUpdateDeliveredData(req.db, pos[0].id);
      }
    }
    
    res.status(201).json({
      message: 'Purchase tax invoice created successfully and inventory updated',
      id: invoiceId,
      invoice_number: invoice_number
    });
  } catch (error) {
    // Rollback transaction on error
    await connection.rollback();
    console.error('Error creating purchase tax invoice:', error);
    res.status(500).json({ 
      message: 'Error creating purchase tax invoice',
      error: error.message 
    });
  } finally {
    // Release connection back to pool
    connection.release();
  }
});

// PUT /api/purchase-tax-invoices/:id - Update purchase tax invoice
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      invoice_number,
      invoice_date,
      supplier_id,
      po_number,
      project_number,
      claim_percentage = 100,
      amount_paid,
      items = []
    } = req.body;
    
    // If only amount_paid is being updated, handle it separately
    const bodyKeys = Object.keys(req.body);
    const hasOnlyAmountPaid = bodyKeys.length === 1 && bodyKeys[0] === 'amount_paid';
    
    if (hasOnlyAmountPaid) {
      // Only updating amount_paid
      const [result] = await req.db.execute(
        'UPDATE purchase_tax_invoices SET amount_paid = ? WHERE id = ?',
        [amount_paid || 0, id]
      );
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Purchase tax invoice not found' });
      }
      
      return res.json({ message: 'Payment amount updated successfully' });
    }
    
    // Calculate totals according to specifications
    let subtotal = 0;
    for (const item of items) {
      const itemTotal = parseFloat(item.quantity) * parseFloat(item.supplier_unit_price);
      subtotal += itemTotal;
    }
    
    // Amount of Claim = Subtotal × %
    const claimPercentage = parseFloat(claim_percentage) || 100;
    const amountOfClaim = subtotal * (claimPercentage / 100);
    
    // VAT (5%) = Amount of Claim × 5%
    const vatAmount = amountOfClaim * 0.05;
    
    // Gross Total = Amount of Claim + VAT
    const grossTotal = amountOfClaim + vatAmount;
    
    // Update invoice
    const amountPaid = amount_paid !== undefined ? amount_paid : null;
    const [result] = await req.db.execute(`
      UPDATE purchase_tax_invoices SET
        invoice_number = ?, invoice_date = ?, supplier_id = ?, po_number = ?,
        project_number = ?, claim_percentage = ?, subtotal = ?, vat_amount = ?, 
        gross_total = ?, amount_paid = COALESCE(?, amount_paid)
      WHERE id = ?
    `, [
      invoice_number, invoice_date, supplier_id, po_number, project_number,
      claim_percentage, subtotal, vatAmount, grossTotal, amountPaid, id
    ]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Purchase tax invoice not found' });
    }
    
    // Delete existing items
    await req.db.execute('DELETE FROM purchase_tax_invoice_items WHERE invoice_id = ?', [id]);
    
    // Add new items
    for (const item of items) {
      const itemTotal = parseFloat(item.quantity) * parseFloat(item.supplier_unit_price);
      
      await req.db.execute(`
        INSERT INTO purchase_tax_invoice_items (
          invoice_id, serial_no, project_no, part_no, material_no,
          description, uom, quantity, supplier_unit_price, total_price
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, item.serial_no, item.project_no, item.part_no, item.material_no,
        item.description, item.uom, item.quantity, item.supplier_unit_price, itemTotal
      ]);
    }
    
    // Recalculate delivered data for the PO if exists
    if (po_number) {
      const [pos] = await req.db.execute(
        'SELECT id FROM purchase_orders WHERE po_number = ?',
        [po_number]
      );
      if (pos.length > 0) {
        // ⚠️ AUTOMATIC TRIGGER: Recalculate delivered data for the PO
        // Triggered when invoice items are updated
        await calculateAndUpdateDeliveredData(req.db, pos[0].id);
      }
    }
    
    res.json({ message: 'Purchase tax invoice updated successfully' });
  } catch (error) {
    console.error('Error updating purchase tax invoice:', error);
    res.status(500).json({ message: 'Error updating purchase tax invoice' });
  }
});

// DELETE /api/purchase-tax-invoices/:id - Delete purchase tax invoice
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the invoice to find its PO number before deleting
    const [invoices] = await req.db.execute('SELECT po_number FROM purchase_tax_invoices WHERE id = ?', [id]);
    const invoice = invoices.length > 0 ? invoices[0] : null;
    
    const [result] = await req.db.execute('DELETE FROM purchase_tax_invoices WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Purchase tax invoice not found' });
    }
    
    // ⚠️ AUTOMATIC TRIGGER: Recalculate delivered data for the PO if it exists
    // Triggered when invoice is deleted to remove its contribution to delivered quantities
    if (invoice && invoice.po_number) {
      const [pos] = await req.db.execute(
        'SELECT id FROM purchase_orders WHERE po_number = ?',
        [invoice.po_number]
      );
      if (pos.length > 0) {
        await calculateAndUpdateDeliveredData(req.db, pos[0].id);
      }
    }
    
    res.json({ message: 'Purchase tax invoice deleted successfully' });
  } catch (error) {
    console.error('Error deleting purchase tax invoice:', error);
    res.status(500).json({ message: 'Error deleting purchase tax invoice' });
  }
});

// GET /api/purchase-tax-invoices/suppliers/list - Get suppliers for dropdown
router.get('/suppliers/list', authenticateToken, async (req, res) => {
  try {
    const [suppliers] = await req.db.execute(`
      SELECT id, company_name, address, contact_person, email, phone, trn_number
      FROM customers_suppliers 
      WHERE type = 'supplier'
      ORDER BY company_name
    `);
    
    res.json(suppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ message: 'Error fetching suppliers' });
  }
});

// GET /api/purchase-tax-invoices/po/list - Get PO numbers for dropdown filtered by supplier
router.get('/po/list', authenticateToken, async (req, res) => {
  try {
    const { supplier_id } = req.query;
    
    let query = `
      SELECT po.id, po.po_number, cs.company_name as supplier_name
      FROM purchase_orders po
      LEFT JOIN customers_suppliers cs ON po.customer_supplier_id = cs.id
      WHERE po.order_type = 'supplier' AND po.status IN ('approved', 'partially_delivered', 'delivered_completed')
    `;
    
    let params = [];
    
    if (supplier_id) {
      query += ' AND po.customer_supplier_id = ?';
      params.push(supplier_id);
    }
    
    query += ' ORDER BY po.created_at DESC';
    
    const [pos] = await req.db.execute(query, params);
    res.json(pos);
  } catch (error) {
    console.error('Error fetching PO numbers:', error);
    res.status(500).json({ message: 'Error fetching PO numbers' });
  }
});

// GET /api/purchase-tax-invoices/po/:po_number - Get PO items for invoice
router.get('/po/:po_number', authenticateToken, async (req, res) => {
  try {
    const { po_number } = req.params;
    
    // Get PO details
    const [pos] = await req.db.execute(`
      SELECT po.*, cs.company_name as supplier_name
      FROM purchase_orders po
      LEFT JOIN customers_suppliers cs ON po.customer_supplier_id = cs.id
      WHERE po.po_number = ? AND po.order_type = 'supplier'
    `, [po_number]);
    
    if (pos.length === 0) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }
    
    // Get PO items
    const [items] = await req.db.execute(`
      SELECT poi.*, i.description as inventory_description
      FROM purchase_order_items poi
      LEFT JOIN inventory i ON poi.part_no = i.part_no
      WHERE poi.po_id = ?
      ORDER BY poi.id
    `, [pos[0].id]);
    
    res.json({
      po: pos[0],
      items
    });
  } catch (error) {
    console.error('Error fetching PO items:', error);
    res.status(500).json({ message: 'Error fetching PO items' });
  }
});

// GET /api/purchase-tax-invoices/:id/pdf - Generate PDF for purchase tax invoice
router.get('/:id/pdf', authenticateToken, async (req, res) => {
  let browser;
  try {
    const { id } = req.params;
    
    // Get invoice details
    const [invoices] = await req.db.execute(`
      SELECT pti.*, 
             cs.company_name as supplier_name,
             cs.address as supplier_address,
             cs.contact_person as supplier_contact,
             cs.email as supplier_email,
             cs.phone as supplier_phone,
             cs.trn_number as supplier_trn,
             u.username as created_by_name
      FROM purchase_tax_invoices pti
      LEFT JOIN customers_suppliers cs ON pti.supplier_id = cs.id
      LEFT JOIN users u ON pti.created_by = u.id
      WHERE pti.id = ?
    `, [id]);
    
    if (invoices.length === 0) {
      return res.status(404).json({ message: 'Purchase tax invoice not found' });
    }
    
    // Get invoice items
    const [items] = await req.db.execute(`
      SELECT * FROM purchase_tax_invoice_items 
      WHERE invoice_id = ? 
      ORDER BY serial_no
    `, [id]);
    
    const invoice = invoices[0];
    
    // Generate HTML for PDF
    const html = generateInvoiceHTML(invoice, items);
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Generate PDF with full color preservation
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: '12mm',
        right: '12mm',
        bottom: '12mm',
        left: '12mm'
      }
    });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Purchase_Tax_Invoice_${invoice.invoice_number}.pdf"`);
    
    // Send PDF
    res.send(pdf);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ message: 'Error generating PDF' });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

// Helper function to generate HTML for PDF - Matching frontend design exactly
function generateInvoiceHTML(invoice, items) {
  const formatCurrency = (amount) => {
    return parseFloat(amount).toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  const amountOfClaim = invoice.subtotal * (invoice.claim_percentage / 100);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Purchase Tax Invoice - ${invoice.invoice_number}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          margin: 0;
          padding: 2rem;
          color: #333;
          background-color: #f8f9fa;
          font-size: 14px;
          line-height: 1.5;
        }
        
        .invoice-container {
          max-width: 1200px;
          margin: 0 auto;
          background-color: white;
          padding: 2rem;
          box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
        }
        
        /* Invoice Header Section - Matching frontend design */
        .invoice-header-section {
          margin-bottom: 2rem;
        }
        
        .header-row {
          display: flex;
          gap: 2rem;
          margin-bottom: 2rem;
        }
        
        .supplier-info-box,
        .invoice-details-box {
          flex: 1;
          border: 2px solid #007bff;
          padding: 1rem;
          background-color: white;
          border-radius: 4px;
        }
        
        .info-row {
          display: flex;
          margin-bottom: 0.5rem;
        }
        
        .info-row:last-child {
          margin-bottom: 0;
        }
        
        .label {
          font-weight: bold;
          min-width: 100px;
          margin-right: 1rem;
          color: #495057;
        }
        
        .value {
          flex: 1;
          color: #212529;
        }
        
        /* Items Table - Matching frontend design exactly */
        .items-section {
          margin-bottom: 2rem;
        }
        
        .table-responsive {
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 0;
          background-color: white;
        }
        
        .table-header {
          background: linear-gradient(135deg, #007bff 0%, #0056b3 100%) !important;
          color: white !important;
        }
        
        .table-header th {
          border: none;
          padding: 1rem 0.75rem;
          font-weight: 600;
          text-align: center;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: white !important;
          background: transparent !important;
        }
        
        .items-table thead th {
          color: white !important;
        }
        
        .items-table thead .table-header {
          background: linear-gradient(135deg, #007bff 0%, #0056b3 100%) !important;
          color: white !important;
        }
        
        .items-table tbody tr:nth-child(even) {
          background-color: #f8f9fa;
        }
        
        .items-table tbody tr:hover {
          background-color: #e3f2fd;
        }
        
        .items-table tbody td {
          padding: 0.75rem;
          vertical-align: middle;
          border: 1px solid #dee2e6;
          text-align: center;
        }
        
        .items-table tbody td:first-child {
          text-align: center;
          font-weight: 600;
          background-color: #e9ecef;
        }
        
        /* Totals Section - Matching frontend design */
        .totals-section {
          margin-bottom: 2rem;
          display: flex;
          justify-content: flex-end;
        }
        
        .totals-box {
          border: 2px solid #28a745;
          padding: 1.5rem;
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          min-width: 400px;
        }
        
        .total-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 0;
          border-bottom: 1px solid #e9ecef;
        }
        
        .total-row:last-child {
          border-bottom: none;
        }
        
        .total-row.total-final {
          border-top: 2px solid #28a745;
          margin-top: 0.5rem;
          padding-top: 1rem;
          font-weight: 700;
          font-size: 1.1rem;
          color: #28a745;
        }
        
        .total-row .label {
          font-weight: 600;
          color: #495057;
          min-width: auto;
          margin-right: 1rem;
        }
        
        .total-row .value {
          font-weight: 600;
          color: #28a745;
          font-size: 1.1rem;
        }
        
        .total-row.total-final .label,
        .total-row.total-final .value {
          color: #28a745;
        }
        
        .footer {
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid #dee2e6;
          text-align: center;
          font-size: 12px;
          color: #666;
        }
        
        /* Print Styles - Matching frontend exactly */
        @media print {
          @page {
            size: auto;
            margin: 12mm;
          }
          
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          body {
            background-color: white !important;
            padding: 0;
            margin: 0;
          }
          
          .invoice-container {
            box-shadow: none;
            padding: 1rem;
            max-width: 100%;
            background-color: white !important;
          }
          
          .invoice-header-section {
            page-break-inside: avoid;
          }
          
          .supplier-info-box,
          .invoice-details-box {
            border: 2px solid #000 !important;
            background-color: white !important;
            page-break-inside: avoid;
          }
          
          .items-section {
            page-break-inside: auto;
          }
          
          .table-responsive {
            box-shadow: none;
          }
          
          .items-table {
            border: 1px solid #000;
          }
          
          .items-table .table-header {
            background: #e9ecef !important;
            color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          .items-table .table-header th {
            border: 1px solid #000 !important;
          }
          
          .items-table tbody tr {
            page-break-inside: avoid;
          }
          
          .items-table tbody tr:nth-child(even) {
            background-color: #f8f9fa !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          .items-table tbody td {
            border: 1px solid #000 !important;
          }
          
          .items-table tbody td:first-child {
            background-color: #e9ecef !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          .totals-section {
            page-break-inside: avoid;
          }
          
          .totals-box {
            border: 2px solid #000 !important;
            background-color: white !important;
            page-break-inside: avoid;
          }
          
          .total-row {
            border-bottom: 1px solid #000 !important;
          }
          
          .total-row.total-final {
            border-top: 2px solid #000 !important;
            color: #000 !important;
          }
          
          .total-row.total-final .label,
          .total-row.total-final .value {
            color: #000 !important;
          }
          
          .footer {
            border-top: 1px solid #000 !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Invoice Header Section -->
        <div class="invoice-header-section">
          <div class="header-row">
            <div class="supplier-info-box">
            <div class="info-row">
              <span class="label">Company:</span>
                <span class="value">${invoice.supplier_name || ''}</span>
            </div>
            <div class="info-row">
              <span class="label">Address:</span>
                <span class="value">${invoice.supplier_address || ''}</span>
            </div>
            <div class="info-row">
              <span class="label">Contact:</span>
                <span class="value">${invoice.supplier_phone || ''}</span>
            </div>
            <div class="info-row">
                <span class="label">Email add.:</span>
                <span class="value">${invoice.supplier_email || ''}</span>
            </div>
          </div>
          
            <div class="invoice-details-box">
            <div class="info-row">
              <span class="label">Inv. No.:</span>
                <span class="value">${invoice.invoice_number}</span>
            </div>
            <div class="info-row">
              <span class="label">Inv. Date:</span>
                <span class="value">${new Date(invoice.invoice_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <div class="info-row">
              <span class="label">Project no.:</span>
                <span class="value">${invoice.project_number || ''}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Items Table -->
        <div class="items-section">
          <div class="table-responsive">
        <table class="items-table">
              <thead class="table-header">
            <tr>
              <th>SERI AL NO.</th>
              <th>PART NO.</th>
              <th>MATERIAL NO.</th>
              <th>DESCRIPTION</th>
              <th>UOM</th>
              <th>QUANTITY</th>
              <th>SUPPLIER UNIT PRICE</th>
              <th>TOTAL PRICE</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                    <td>${item.serial_no || ''}</td>
                <td>${item.part_no || ''}</td>
                <td>${item.material_no || ''}</td>
                <td>${item.description || ''}</td>
                <td>${item.uom || ''}</td>
                    <td>${parseFloat(item.quantity).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>${formatCurrency(item.supplier_unit_price)}</td>
                <td>${formatCurrency(item.total_price)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
          </div>
        </div>
        
        <!-- Totals Section -->
        <div class="totals-section">
          <div class="totals-box">
            <div class="total-row">
              <span class="label">SUB-TOTAL:</span>
              <span class="value">${formatCurrency(invoice.subtotal)}</span>
            </div>
            <div class="total-row">
              <span class="label">Amount of Claim ${invoice.claim_percentage}%:</span>
              <span class="value">${formatCurrency(amountOfClaim)}</span>
            </div>
            <div class="total-row">
              <span class="label">VAT 5%:</span>
              <span class="value">${formatCurrency(invoice.vat_amount)}</span>
            </div>
            <div class="total-row total-final">
              <span class="label">TOTAL:</span>
              <span class="value">${formatCurrency(invoice.gross_total)}</span>
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <p>Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} | AllTech Business Management System</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = router;
