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
        claim_percentage, subtotal, vat_amount, gross_total, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      invoice_number, invoice_date, supplier_id, po_number, project_number,
      claim_percentage, subtotal, vatAmount, grossTotal, createdBy
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
      
      // Update inventory - match by project_no, part_no, description, AND unit_price (supplier_unit_price)
      // ⚠️ IMPORTANT: Only update existing inventory if ALL four fields match exactly
      // If any field differs, create a new inventory record
      if (item.part_no && item.description) {
        // Check if inventory item exists - match by project_no, part_no, description, AND supplier_unit_price
        const [existingItems] = await connection.execute(`
          SELECT id, quantity, sold_quantity, supplier_unit_price
          FROM inventory 
          WHERE project_no = ? AND part_no = ? AND description = ? AND supplier_unit_price = ?
        `, [item.project_no || project_number, item.part_no, item.description, unitPrice]);
        
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
          // This happens when any of the key fields differ (project_no, part_no, description, or unit_price)
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
router.put('/:id', authenticateToken, validatePurchaseTaxInvoice, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { id } = req.params;
    const {
      invoice_number,
      invoice_date,
      supplier_id,
      po_number,
      project_number,
      claim_percentage = 100,
      items = []
    } = req.body;
    
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
    const [result] = await req.db.execute(`
      UPDATE purchase_tax_invoices SET
        invoice_number = ?, invoice_date = ?, supplier_id = ?, po_number = ?,
        project_number = ?, claim_percentage = ?, subtotal = ?, vat_amount = ?, gross_total = ?
      WHERE id = ?
    `, [
      invoice_number, invoice_date, supplier_id, po_number, project_number,
      claim_percentage, subtotal, vatAmount, grossTotal, id
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
    
    // Generate PDF
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
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

// Helper function to generate HTML for PDF
function generateInvoiceHTML(invoice, items) {
  const formatCurrency = (amount) => {
    return parseFloat(amount).toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Purchase Tax Invoice - ${invoice.invoice_number}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          color: #333;
        }
        .invoice-container {
          max-width: 800px;
          margin: 0 auto;
          border: 1px solid #ddd;
          padding: 20px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
        }
        .supplier-info, .invoice-details {
          border: 2px solid #007bff;
          padding: 15px;
          background: white;
        }
        .supplier-info h4, .invoice-details h4 {
          margin: 0 0 10px 0;
          color: #007bff;
        }
        .info-row {
          margin-bottom: 5px;
        }
        .label {
          font-weight: bold;
          display: inline-block;
          width: 100px;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        .items-table th {
          background: #007bff;
          color: white;
          padding: 10px;
          text-align: center;
          font-size: 12px;
        }
        .items-table td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: center;
        }
        .items-table tr:nth-child(even) {
          background: #f9f9f9;
        }
        .totals-section {
          display: flex;
          justify-content: flex-end;
          margin-top: 20px;
        }
        .totals-box {
          border: 2px solid #28a745;
          padding: 15px;
          background: white;
          min-width: 300px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .total-row.total-final {
          border-top: 2px solid #28a745;
          padding-top: 10px;
          font-weight: bold;
          font-size: 16px;
          color: #28a745;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="header">
          <div class="supplier-info">
            <h4>Supplier Information</h4>
            <div class="info-row">
              <span class="label">Company:</span>
              <span>${invoice.supplier_name || ''}</span>
            </div>
            <div class="info-row">
              <span class="label">Address:</span>
              <span>${invoice.supplier_address || ''}</span>
            </div>
            <div class="info-row">
              <span class="label">Contact:</span>
              <span>${invoice.supplier_phone || ''}</span>
            </div>
            <div class="info-row">
              <span class="label">Email:</span>
              <span>${invoice.supplier_email || ''}</span>
            </div>
          </div>
          
          <div class="invoice-details">
            <h4>Invoice Details</h4>
            <div class="info-row">
              <span class="label">Inv. No.:</span>
              <span>${invoice.invoice_number}</span>
            </div>
            <div class="info-row">
              <span class="label">Inv. Date:</span>
              <span>${new Date(invoice.invoice_date).toLocaleDateString()}</span>
            </div>
            <div class="info-row">
              <span class="label">Project no.:</span>
              <span>${invoice.project_number || ''}</span>
            </div>
          </div>
        </div>
        
        <table class="items-table">
          <thead>
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
                <td>${item.serial_no}</td>
                <td>${item.part_no || ''}</td>
                <td>${item.material_no || ''}</td>
                <td>${item.description || ''}</td>
                <td>${item.uom || ''}</td>
                <td>${item.quantity}</td>
                <td>${formatCurrency(item.supplier_unit_price)}</td>
                <td>${formatCurrency(item.total_price)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="totals-section">
          <div class="totals-box">
            <div class="total-row">
              <span>SUB-TOTAL:</span>
              <span>${formatCurrency(invoice.subtotal)}</span>
            </div>
            <div class="total-row">
              <span>Amount of Claim ${invoice.claim_percentage}%:</span>
              <span>${formatCurrency(invoice.subtotal * (invoice.claim_percentage / 100))}</span>
            </div>
            <div class="total-row">
              <span>VAT 5%:</span>
              <span>${formatCurrency(invoice.vat_amount)}</span>
            </div>
            <div class="total-row total-final">
              <span>TOTAL:</span>
              <span>${formatCurrency(invoice.gross_total)}</span>
            </div>
          </div>
        </div>
        
        <div class="footer">
          <p>Generated on ${new Date().toLocaleDateString()} | AllTech Business Management System</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = router;
