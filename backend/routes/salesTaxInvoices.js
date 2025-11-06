const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { calculateAndUpdateDeliveredData } = require('./databaseDashboard');

// Helper function to convert number to words
function numberToWords(num) {
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const thousands = ['', 'thousand', 'million', 'billion'];

  function convertHundreds(n) {
    let result = '';
    
    if (n > 99) {
      result += ones[Math.floor(n / 100)] + ' hundred';
      n %= 100;
      if (n > 0) result += ' ';
    }
    
    if (n > 19) {
      result += tens[Math.floor(n / 10)];
      n %= 10;
      if (n > 0) result += ' ' + ones[n];
    } else if (n > 9) {
      result += teens[n - 10];
    } else if (n > 0) {
      result += ones[n];
    }
    
    return result;
  }

  if (num === 0) return 'zero';
  
  let result = '';
  let thousandIndex = 0;
  
  while (num > 0) {
    const chunk = num % 1000;
    if (chunk !== 0) {
      const chunkWords = convertHundreds(chunk);
      if (thousandIndex > 0) {
        result = chunkWords + ' ' + thousands[thousandIndex] + (result ? ' ' + result : '');
      } else {
        result = chunkWords;
      }
    }
    num = Math.floor(num / 1000);
    thousandIndex++;
  }
  
  return result;
}

// Helper function to generate invoice number
async function generateInvoiceNumber(db) {
  const currentYear = new Date().getFullYear();
  const prefix = `AT-INV-${currentYear}-`;
  
  // Get the highest sequential number for this year
  const [result] = await db.execute(
    'SELECT invoice_number FROM sales_tax_invoices WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1',
    [`${prefix}%`]
  );
  
  let nextNumber = 1;
  if (result.length > 0) {
    const lastInvoice = result[0].invoice_number;
    const lastNumber = parseInt(lastInvoice.split('-').pop());
    nextNumber = lastNumber + 1;
  }
  
  return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
}

// Validation middleware
const validateSalesTaxInvoice = [
  body('customer_id').notEmpty().withMessage('Customer ID is required'),
  body('invoice_date').isISO8601().toDate().withMessage('Valid invoice date is required'),
  body('claim_percentage').isNumeric().isFloat({ min: 0, max: 100 }).withMessage('Claim percentage must be between 0 and 100'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.quantity').isNumeric().isFloat({ min: 0 }).withMessage('Quantity must be a positive number'),
  body('items.*.unit_price').isNumeric().isFloat({ min: 0 }).withMessage('Unit price must be a positive number')
];

// GET /api/sales-tax-invoices - Get all sales tax invoices
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, customer_id, customer_po_number } = req.query;
    
    let query = `
      SELECT sti.*, 
             cs.company_name as customer_name,
             u.username as created_by_name
      FROM sales_tax_invoices sti
      LEFT JOIN customers_suppliers cs ON sti.customer_id = cs.id
      LEFT JOIN users u ON sti.created_by = u.id
    `;
    
    let countQuery = 'SELECT COUNT(*) as total FROM sales_tax_invoices sti';
    let params = [];
    let conditions = [];
    
    if (customer_id) {
      conditions.push('sti.customer_id = ?');
      params.push(customer_id);
    }
    
    if (customer_po_number) {
      conditions.push('sti.customer_po_number = ?');
      params.push(customer_po_number);
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }
    
    query += ' ORDER BY sti.created_at DESC';
    
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
    console.error('Error fetching sales tax invoices:', error);
    res.status(500).json({ message: 'Error fetching sales tax invoices' });
  }
});

// GET /api/sales-tax-invoices/:id - Get single sales tax invoice with items
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get invoice details
    const [invoices] = await req.db.execute(`
      SELECT sti.*, 
             cs.company_name as customer_name,
             cs.address as customer_address,
             cs.trn_number as customer_trn,
             cs.email as customer_email,
             cs.phone as customer_phone,
             u.username as created_by_name
      FROM sales_tax_invoices sti
      LEFT JOIN customers_suppliers cs ON sti.customer_id = cs.id
      LEFT JOIN users u ON sti.created_by = u.id
      WHERE sti.id = ?
    `, [id]);
    
    if (invoices.length === 0) {
      return res.status(404).json({ message: 'Sales tax invoice not found' });
    }
    
    // Get invoice items
    const [items] = await req.db.execute(`
      SELECT * FROM sales_tax_invoice_items WHERE invoice_id = ? ORDER BY id
    `, [id]);
    
    res.json({
      invoice: invoices[0],
      items
    });
  } catch (error) {
    console.error('Error fetching sales tax invoice:', error);
    res.status(500).json({ message: 'Error fetching sales tax invoice' });
  }
});

// POST /api/sales-tax-invoices - Create new sales tax invoice
router.post('/', validateSalesTaxInvoice, async (req, res) => {
  const connection = await req.db.getConnection();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const {
      customer_id,
      invoice_date,
      customer_po_number,
      customer_po_date,
      payment_terms,
      contract_number,
      delivery_terms,
      claim_percentage,
      items
    } = req.body;
    
    // Start transaction
    await connection.beginTransaction();
    
    // Validate customer exists
    const [customer] = await connection.execute(
      'SELECT id, company_name FROM customers_suppliers WHERE id = ? AND type = "customer"',
      [customer_id]
    );
    
    if (customer.length === 0) {
      return res.status(400).json({ message: 'Customer not found' });
    }
    
    // Check claim percentage validation
    if (customer_po_number) {
      const [existingClaims] = await connection.execute(`
        SELECT SUM(claim_percentage) as total_claimed 
        FROM sales_tax_invoices 
        WHERE customer_po_number = ?
      `, [customer_po_number]);
      
      const totalClaimed = existingClaims[0].total_claimed || 0;
      if (totalClaimed + claim_percentage > 100) {
        return res.status(400).json({ 
          message: `Total claim percentage cannot exceed 100%. Already claimed: ${totalClaimed}%, attempting to claim: ${claim_percentage}%` 
        });
      }
    }
    
    // STEP 1: Validate inventory availability for ALL items BEFORE creating invoice
    const inventoryValidationErrors = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const saleQuantity = parseFloat(item.quantity) || 0;
      
      // Skip validation if part_no or material_no is missing
      if (!item.part_no || !item.material_no) {
        inventoryValidationErrors.push({
          item_index: i + 1,
          part_no: item.part_no,
          material_no: item.material_no,
          error: 'Missing part_no or material_no'
        });
        continue;
      }
      
      // Check inventory availability
      const [inventoryItems] = await connection.execute(`
        SELECT id, part_no, material_no, balance, quantity, sold_quantity, supplier_unit_price
        FROM inventory 
        WHERE part_no = ? AND material_no = ?
      `, [item.part_no, item.material_no]);
      
      if (inventoryItems.length === 0) {
        inventoryValidationErrors.push({
          item_index: i + 1,
          part_no: item.part_no,
          material_no: item.material_no,
          requested_quantity: saleQuantity,
          error: 'Item not found in inventory'
        });
        continue;
      }
      
      const inventoryItem = inventoryItems[0];
      const availableBalance = parseFloat(inventoryItem.balance) || 0;
      
      // Validate balance > 0
      if (availableBalance <= 0) {
        inventoryValidationErrors.push({
          item_index: i + 1,
          part_no: item.part_no,
          material_no: item.material_no,
          requested_quantity: saleQuantity,
          available_balance: availableBalance,
          error: 'No stock available (balance is 0 or negative)'
        });
        continue;
      }
      
      // Validate requested quantity <= available balance
      if (saleQuantity > availableBalance) {
        inventoryValidationErrors.push({
          item_index: i + 1,
          part_no: item.part_no,
          material_no: item.material_no,
          requested_quantity: saleQuantity,
          available_balance: availableBalance,
          error: `Insufficient stock. Requested: ${saleQuantity}, Available: ${availableBalance}`
        });
      }
    }
    
    // If any validation errors, return them and don't create invoice
    if (inventoryValidationErrors.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Inventory validation failed. Cannot create sales invoice.',
        validation_errors: inventoryValidationErrors
      });
    }
    
    // STEP 2: All validations passed - Create invoice
    
    // Calculate totals
    let subtotal = 0;
    for (const item of items) {
      subtotal += item.quantity * item.unit_price;
    }
    
    const claimAmount = subtotal * (claim_percentage / 100);
    const vatAmount = claimAmount * 0.05;
    const grossTotal = claimAmount + vatAmount;
    
    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(connection);
    
    // Convert amount to words
    const amountInWords = `AED ${numberToWords(Math.floor(grossTotal))} and ${Math.floor((grossTotal % 1) * 100).toString().padStart(2, '0')}/100 Only`;
    
    // Create invoice
    const createdBy = req.user?.id || null;
    const amountPaid = req.body.amount_paid || 0;
    
    const [result] = await connection.execute(`
      INSERT INTO sales_tax_invoices (
        invoice_number, invoice_date, customer_id, customer_po_number, customer_po_date,
        payment_terms, contract_number, delivery_terms, claim_percentage,
        subtotal, claim_amount, vat_amount, gross_total, amount_paid, amount_in_words, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      invoiceNumber, invoice_date, customer_id, customer_po_number, customer_po_date,
      payment_terms, contract_number, delivery_terms, claim_percentage,
      subtotal, claimAmount, vatAmount, grossTotal, amountPaid, amountInWords, createdBy
    ]);
    
    const invoiceId = result.insertId;
    
    // STEP 3: Add invoice items AND update inventory
    for (const item of items) {
      const saleQuantity = parseFloat(item.quantity) || 0;
      const totalAmount = saleQuantity * item.unit_price;
      
      // Insert invoice item
      await connection.execute(`
        INSERT INTO sales_tax_invoice_items (
          invoice_id, part_no, material_no, project_no, description, quantity, unit_price, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        invoiceId, item.part_no || null, item.material_no || null, item.project_no || null, item.description || null,
        saleQuantity, item.unit_price, totalAmount
      ]);
      
      // Update inventory - Reduce stock
      // Match by project_no, part_no, description
      if (item.part_no && item.description) {
        // Get matching inventory records (FIFO - oldest first)
        const [inventoryItems] = await connection.execute(`
          SELECT id, quantity, sold_quantity, balance, supplier_unit_price, project_no, part_no, description
          FROM inventory 
          WHERE project_no = ? AND part_no = ? AND description = ?
          ORDER BY created_at ASC
        `, [item.project_no || null, item.part_no, item.description]);
        
        if (inventoryItems.length > 0) {
          // Use FIFO - update the oldest matching record first
          const inventoryItem = inventoryItems[0];
          const currentSoldQuantity = parseFloat(inventoryItem.sold_quantity) || 0;
          const currentQuantity = parseFloat(inventoryItem.quantity) || 0;
          const unitPrice = parseFloat(inventoryItem.supplier_unit_price) || 0;
          
          // Calculate available stock
          const availableStock = currentQuantity - currentSoldQuantity;
          
          // Check if there's enough stock
          if (availableStock >= saleQuantity) {
            // Calculate new values
            const newSoldQuantity = currentSoldQuantity + saleQuantity;
            const newBalance = currentQuantity - newSoldQuantity;
            // Calculate balance_amount = balance × supplier_unit_price
            const newBalanceAmount = newBalance * unitPrice;
            
            // Update inventory record - sold_quantity, balance, and balance_amount
            await connection.execute(`
              UPDATE inventory 
              SET sold_quantity = ?,
                  balance = ?,
                  balance_amount = ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [
              newSoldQuantity,
              newBalance,
              newBalanceAmount,
              inventoryItem.id
            ]);
            
            console.log(`✓ Inventory updated (FIFO): project_no=${item.project_no}, part_no=${item.part_no}, sold_quantity: ${currentSoldQuantity} + ${saleQuantity} = ${newSoldQuantity}, new_balance=${newBalance}, balance_amount=${newBalanceAmount}`);
          } else {
            console.log(`⚠️ Insufficient stock: Available=${availableStock}, Required=${saleQuantity}`);
            throw new Error(`Insufficient stock for ${item.part_no}. Available: ${availableStock}, Required: ${saleQuantity}`);
          }
        } else {
          console.log(`⚠️ No matching inventory found for project_no=${item.project_no}, part_no=${item.part_no}, description=${item.description}`);
          // Skip item without creating new record (as per requirements)
        }
      }
    }
    
    // Commit transaction
    await connection.commit();
    console.log('✓ Sales invoice created and inventory updated successfully');
    
    // ⚠️ AUTOMATIC TRIGGER: Recalculate delivered data for the PO if exists
    // This ensures delivered_quantity, delivered_unit_price, delivered_total_price,
    // penalty_amount, and balance_quantity_undelivered are updated from invoice data
    if (customer_po_number) {
      const [pos] = await connection.execute(
        'SELECT id FROM purchase_orders WHERE po_number = ?',
        [customer_po_number]
      );
      if (pos.length > 0) {
        await calculateAndUpdateDeliveredData(req.db, pos[0].id);
      }
    }
    
    res.status(201).json({
      message: 'Sales tax invoice created successfully and inventory updated',
      id: invoiceId,
      invoice_number: invoiceNumber
    });
    
  } catch (error) {
    // Rollback transaction on error
    await connection.rollback();
    console.error('Error creating sales tax invoice:', error);
    console.error('Error code:', error.code);
    console.error('Error SQL State:', error.sqlState);
    console.error('Error details:', error);
    res.status(500).json({ 
      message: 'Error creating sales tax invoice',
      error: error.message,
      sqlError: error.code,
      sqlState: error.sqlState
    });
  } finally {
    // Release connection back to pool
    connection.release();
  }
});

// PUT /api/sales-tax-invoices/:id - Update sales tax invoice
router.put('/:id', async (req, res) => {
  try {
    
    const { id } = req.params;
    const {
      customer_id,
      invoice_date,
      customer_po_number,
      customer_po_date,
      payment_terms,
      contract_number,
      delivery_terms,
      claim_percentage,
      amount_paid,
      items
    } = req.body;
    
    // If only amount_paid is being updated, handle it separately
    const bodyKeys = Object.keys(req.body);
    const hasOnlyAmountPaid = bodyKeys.length === 1 && bodyKeys[0] === 'amount_paid';
    
    if (hasOnlyAmountPaid) {
      // Only updating amount_paid
      const [result] = await req.db.execute(
        'UPDATE sales_tax_invoices SET amount_paid = ? WHERE id = ?',
        [amount_paid || 0, id]
      );
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Sales tax invoice not found' });
      }
      
      return res.json({ message: 'Payment amount updated successfully' });
    }
    
    // Validate customer exists
    const [customer] = await req.db.execute(
      'SELECT id, company_name FROM customers_suppliers WHERE id = ? AND type = "customer"',
      [customer_id]
    );
    
    if (customer.length === 0) {
      return res.status(400).json({ message: 'Customer not found' });
    }
    
    // Check claim percentage validation (exclude current invoice)
    if (customer_po_number) {
      const [existingClaims] = await req.db.execute(`
        SELECT SUM(claim_percentage) as total_claimed 
        FROM sales_tax_invoices 
        WHERE customer_po_number = ? AND id != ?
      `, [customer_po_number, id]);
      
      const totalClaimed = existingClaims[0].total_claimed || 0;
      if (totalClaimed + claim_percentage > 100) {
        return res.status(400).json({ 
          message: `Total claim percentage cannot exceed 100%. Already claimed: ${totalClaimed}%, attempting to claim: ${claim_percentage}%` 
        });
      }
    }
    
    // Calculate totals
    let subtotal = 0;
    for (const item of items) {
      subtotal += item.quantity * item.unit_price;
    }
    
    const claimAmount = subtotal * (claim_percentage / 100);
    const vatAmount = claimAmount * 0.05;
    const grossTotal = claimAmount + vatAmount;
    
    // Convert amount to words
    const amountInWords = `AED ${numberToWords(Math.floor(grossTotal))} and ${Math.floor((grossTotal % 1) * 100).toString().padStart(2, '0')}/100 Only`;
    
    // Update invoice
    const amountPaid = amount_paid !== undefined ? amount_paid : null;
    const [result] = await req.db.execute(`
      UPDATE sales_tax_invoices SET
        invoice_date = ?, customer_id = ?, customer_po_number = ?, customer_po_date = ?,
        payment_terms = ?, contract_number = ?, delivery_terms = ?, claim_percentage = ?,
        subtotal = ?, claim_amount = ?, vat_amount = ?, gross_total = ?, 
        amount_paid = COALESCE(?, amount_paid), amount_in_words = ?
      WHERE id = ?
    `, [
      invoice_date, customer_id, customer_po_number, customer_po_date,
      payment_terms, contract_number, delivery_terms, claim_percentage,
      subtotal, claimAmount, vatAmount, grossTotal, amountPaid, amountInWords, id
    ]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Sales tax invoice not found' });
    }
    
    // Update items
    await req.db.execute('DELETE FROM sales_tax_invoice_items WHERE invoice_id = ?', [id]);
    
    for (const item of items) {
      const totalAmount = item.quantity * item.unit_price;
      await req.db.execute(`
        INSERT INTO sales_tax_invoice_items (
          invoice_id, part_no, material_no, project_no, description, quantity, unit_price, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, item.part_no || null, item.material_no || null, item.project_no || null, item.description || null,
        item.quantity, item.unit_price, totalAmount
      ]);
    }
    
    // ⚠️ AUTOMATIC TRIGGER: Recalculate delivered data for the PO if exists
    // Triggered when invoice items are updated
    if (customer_po_number) {
      const [pos] = await req.db.execute(
        'SELECT id FROM purchase_orders WHERE po_number = ?',
        [customer_po_number]
      );
      if (pos.length > 0) {
        await calculateAndUpdateDeliveredData(req.db, pos[0].id);
      }
    }
    
    res.json({ message: 'Sales tax invoice updated successfully' });
  } catch (error) {
    console.error('Error updating sales tax invoice:', error);
    res.status(500).json({ message: 'Error updating sales tax invoice' });
  }
});

// DELETE /api/sales-tax-invoices/:id - Delete sales tax invoice
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the invoice to find its PO number before deleting
    const [invoices] = await req.db.execute('SELECT customer_po_number FROM sales_tax_invoices WHERE id = ?', [id]);
    const invoice = invoices.length > 0 ? invoices[0] : null;
    
    const [result] = await req.db.execute('DELETE FROM sales_tax_invoices WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Sales tax invoice not found' });
    }
    
    // ⚠️ AUTOMATIC TRIGGER: Recalculate delivered data for the PO if it exists
    // Triggered when invoice is deleted to remove its contribution to delivered quantities
    if (invoice && invoice.customer_po_number) {
      const [pos] = await req.db.execute(
        'SELECT id FROM purchase_orders WHERE po_number = ?',
        [invoice.customer_po_number]
      );
      if (pos.length > 0) {
        await calculateAndUpdateDeliveredData(req.db, pos[0].id);
      }
    }
    
    res.json({ message: 'Sales tax invoice deleted successfully' });
  } catch (error) {
    console.error('Error deleting sales tax invoice:', error);
    res.status(500).json({ message: 'Error deleting sales tax invoice' });
  }
});

// GET /api/sales-tax-invoices/customer/:customer_id/po-numbers - Get approved PO numbers for customer
router.get('/customer/:customer_id/po-numbers', async (req, res) => {
  try {
    const { customer_id } = req.params;
    
    // Get approved and delivered purchase orders for the customer
    const [pos] = await req.db.execute(`
      SELECT po.id, po.po_number, po.created_at
      FROM purchase_orders po
      WHERE po.customer_supplier_id = ? 
        AND po.order_type = 'customer' 
        AND po.status IN ('approved', 'partially_delivered', 'delivered_completed')
      ORDER BY po.created_at DESC
    `, [customer_id]);
    
    res.json(pos);
  } catch (error) {
    console.error('Error fetching customer PO numbers:', error);
    res.status(500).json({ message: 'Error fetching customer PO numbers' });
  }
});

// GET /api/sales-tax-invoices/customer-po/:po_number - Get items from customer PO
router.get('/customer-po/:po_number', async (req, res) => {
  try {
    const { po_number } = req.params;
    
    // Get purchase order items for the customer PO
    const [items] = await req.db.execute(`
      SELECT poi.part_no, poi.material_no, poi.project_no, poi.description, poi.quantity, poi.unit_price
      FROM purchase_order_items poi
      INNER JOIN purchase_orders po ON poi.po_id = po.id
      WHERE po.po_number = ? AND po.order_type = 'customer'
    `, [po_number]);
    
    if (items.length === 0) {
      return res.status(404).json({ message: 'No items found for this customer PO number' });
    }
    
    res.json(items);
  } catch (error) {
    console.error('Error fetching customer PO items:', error);
    res.status(500).json({ message: 'Error fetching customer PO items' });
  }
});

// GET /api/sales-tax-invoices/:id/pdf - Generate PDF for invoice
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get invoice details with customer info
    const [invoices] = await req.db.execute(`
      SELECT sti.*, 
             cs.company_name as customer_name,
             cs.address as customer_address,
             cs.trn_number as customer_trn,
             cs.email as customer_email,
             cs.phone as customer_phone
      FROM sales_tax_invoices sti
      LEFT JOIN customers_suppliers cs ON sti.customer_id = cs.id
      WHERE sti.id = ?
    `, [id]);
    
    if (invoices.length === 0) {
      return res.status(404).json({ message: 'Sales tax invoice not found' });
    }
    
    // Get invoice items
    const [items] = await req.db.execute(`
      SELECT * FROM sales_tax_invoice_items WHERE invoice_id = ? ORDER BY id
    `, [id]);
    
    // For now, return JSON data. PDF generation can be implemented later with libraries like puppeteer
    res.json({
      invoice: invoices[0],
      items,
      message: 'PDF generation endpoint - implement with puppeteer or similar library'
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ message: 'Error generating PDF' });
  }
});

module.exports = router;




