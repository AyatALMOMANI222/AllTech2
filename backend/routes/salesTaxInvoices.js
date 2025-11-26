const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { calculateAndUpdateDeliveredData } = require('./databaseDashboard');
const {
  uploadFile: uploadToBunny,
  downloadFile,
  deleteFile: deleteFromBunny
} = require('../services/bunnyStorage');
const { detectDocumentType } = require('../utils/document_type');

const INVOICE_DOCUMENT_MAX_FILE_SIZE = parseInt(
  process.env.INVOICE_DOCUMENT_MAX_FILE_SIZE || `${25 * 1024 * 1024}`,
  10
);
const invoiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: INVOICE_DOCUMENT_MAX_FILE_SIZE,
    files: 10,
  },
});

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
      
      // Skip validation if part_no is missing (required field)
      if (!item.part_no) {
        inventoryValidationErrors.push({
          item_index: i + 1,
          part_no: item.part_no,
          project_no: item.project_no,
          description: item.description,
          error: 'Missing part_no (required field)'
        });
        continue;
      }
      
      // Check inventory availability
      // Match by project_no, part_no, and description (all three must match exactly)
      // If multiple matches exist, use FIFO (first-in-first-out) - the earliest added record
      const [inventoryItems] = await connection.execute(`
        SELECT id, part_no, material_no, project_no, description, balance, quantity, sold_quantity, supplier_unit_price
        FROM inventory 
        WHERE project_no = ? AND part_no = ? AND description = ?
        ORDER BY created_at ASC
        LIMIT 1
      `, [item.project_no || null, item.part_no, item.description || null]);
      
      if (inventoryItems.length === 0) {
        inventoryValidationErrors.push({
          item_index: i + 1,
          project_no: item.project_no,
          part_no: item.part_no,
          description: item.description,
          requested_quantity: saleQuantity,
          error: 'Item not found in inventory'
        });
        continue;
      }
      
      const inventoryItem = inventoryItems[0];
      const currentQuantity = parseFloat(inventoryItem.quantity) || 0;
      const currentSoldQuantity = parseFloat(inventoryItem.sold_quantity) || 0;
      const balanceFromDB = parseFloat(inventoryItem.balance) || 0;
      
      // Calculate available balance: quantity - sold_quantity (don't rely on balance field alone)
      // This ensures we always use the correct calculation even if balance is out of sync
      const calculatedBalance = currentQuantity - currentSoldQuantity;
      const availableBalance = calculatedBalance;
      
      // Validate balance > 0
      if (availableBalance <= 0) {
        inventoryValidationErrors.push({
          item_index: i + 1,
          project_no: item.project_no,
          part_no: item.part_no,
          description: item.description,
          requested_quantity: saleQuantity,
          available_balance: availableBalance,
          quantity: currentQuantity,
          sold_quantity: currentSoldQuantity,
          error: 'No stock available (balance is 0 or negative)'
        });
        continue;
      }
      
      // Validate requested quantity <= available balance
      if (saleQuantity > availableBalance) {
        inventoryValidationErrors.push({
          item_index: i + 1,
          project_no: item.project_no,
          part_no: item.part_no,
          description: item.description,
          requested_quantity: saleQuantity,
          available_balance: availableBalance,
          quantity: currentQuantity,
          sold_quantity: currentSoldQuantity,
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
      // Match by project_no, part_no, and description (all three must match exactly)
      // If multiple matches exist (same project_no, part_no, description but different unit prices),
      // update only one record at a time according to FIFO (first-in-first-out) - the earliest added record
      if (item.part_no) {
        // Get matching inventory records (FIFO - oldest first)
        // Match by project_no, part_no, and description (all three must match exactly)
        const [inventoryItems] = await connection.execute(`
          SELECT id, quantity, sold_quantity, balance, supplier_unit_price, project_no, part_no, material_no, description
          FROM inventory 
          WHERE project_no = ? AND part_no = ? AND description = ?
          ORDER BY created_at ASC
          LIMIT 1
        `, [item.project_no || null, item.part_no, item.description || null]);
        
        if (inventoryItems.length > 0) {
          // Use FIFO - update the oldest matching record first (LIMIT 1 ensures only one record)
          const inventoryItem = inventoryItems[0];
          const currentSoldQuantity = parseFloat(inventoryItem.sold_quantity) || 0;
          const currentQuantity = parseFloat(inventoryItem.quantity) || 0;
          const currentBalance = parseFloat(inventoryItem.balance) || 0;
          const unitPrice = parseFloat(inventoryItem.supplier_unit_price) || 0;
          
          // Calculate available stock - always use quantity - sold_quantity to ensure accuracy
          // Don't rely on balance field alone as it might be out of sync
          const calculatedBalance = currentQuantity - currentSoldQuantity;
          
          // Use calculated balance (quantity - sold_quantity) for consistency
          const finalAvailableStock = calculatedBalance;
          
          // Check if there's enough stock before deducting to prevent negative inventory
          if (finalAvailableStock >= saleQuantity && finalAvailableStock > 0) {
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
            
            console.log(`✓ Inventory updated (FIFO): project_no=${item.project_no}, part_no=${item.part_no}, description=${item.description}, sold_quantity: ${currentSoldQuantity} + ${saleQuantity} = ${newSoldQuantity}, new_balance=${newBalance}, balance_amount=${newBalanceAmount}`);
          } else {
            // Insufficient stock - skip this item (don't throw error, just log and continue)
            console.log(`⚠️ Insufficient stock: Available=${finalAvailableStock}, Required=${saleQuantity}, Balance=${currentBalance}, Quantity=${currentQuantity}, Sold=${currentSoldQuantity}. Skipping inventory update for this item.`);
            // Continue to next item without updating inventory
          }
        } else {
          // No matching inventory record found - skip this item (don't throw error, just log and continue)
          console.log(`⚠️ No matching inventory found for project_no=${item.project_no}, part_no=${item.part_no}, description=${item.description}. Skipping inventory update for this item.`);
          // Continue to next item without updating inventory
        }
      } else {
        // Missing part_no - skip this item (don't throw error, just log and continue)
        console.log(`⚠️ Missing part_no for item. Skipping inventory update for this item.`);
        // Continue to next item without updating inventory
      }
    }
    
    // Commit transaction
    await connection.commit();
    console.log('✓ Sales invoice created and inventory updated successfully');
    
    // ⚠️ AUTOMATIC TRIGGER: Recalculate delivered data for the PO if exists
    // This ensures delivered_quantity, delivered_unit_price, delivered_total_price,
    // penalty_amount, and balance_quantity_undelivered are updated from invoice data
    // For sales tax invoices, only update customer POs (order_type = 'customer')
    if (customer_po_number) {
      try {
        const [pos] = await connection.execute(
          'SELECT id FROM purchase_orders WHERE po_number = ? AND order_type = ? LIMIT 1',
          [customer_po_number, 'customer']
        );
        if (pos.length > 0) {
          // Wrap in try-catch to prevent failure of entire transaction if calculation fails
          try {
            await calculateAndUpdateDeliveredData(req.db, pos[0].id);
          } catch (calcError) {
            console.error('Error calculating delivered data (non-fatal):', calcError);
            // Don't throw - invoice creation should succeed even if calculation fails
          }
        }
      } catch (poError) {
        console.error('Error finding PO for recalculation (non-fatal):', poError);
        // Don't throw - invoice creation should succeed even if PO lookup fails
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

// Document management for sales invoices
router.get('/:id/documents', async (req, res) => {
  try {
    const { id } = req.params;
    const [invoices] = await req.db.execute(
      'SELECT id, invoice_number FROM sales_tax_invoices WHERE id = ? LIMIT 1',
      [id]
    );

    if (invoices.length === 0) {
      return res.status(404).json({ success: false, message: 'Sales tax invoice not found' });
    }

    const [documents] = await req.db.execute(
      `
        SELECT id, invoice_type, document_name, document_type, storage_path, storage_url, uploaded_by, created_at
        FROM invoice_documents
        WHERE invoice_type = 'sales' AND invoice_id = ?
        ORDER BY created_at DESC
      `,
      [id]
    );

    res.json({ success: true, records: documents });
  } catch (error) {
    console.error('Error fetching sales invoice documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales invoice documents.',
      error: error.message
    });
  }
});

router.post('/:id/documents', invoiceUpload.array('documents', 10), async (req, res) => {
  const { id } = req.params;

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Please provide at least one document to upload.'
    });
  }

  let connection;
  const uploadedRemotePaths = [];
  const insertedRecords = [];

  try {
    const [invoices] = await req.db.execute(
      'SELECT id, invoice_number FROM sales_tax_invoices WHERE id = ? LIMIT 1',
      [id]
    );

    if (invoices.length === 0) {
      return res.status(404).json({ success: false, message: 'Sales tax invoice not found' });
    }

    const invoice = invoices[0];
    const directory = `invoices/sales/${invoice.invoice_number || invoice.id}`;
    const createdBy = req.user?.id || null;

    connection = await req.db.getConnection();
    await connection.beginTransaction();

    for (const file of req.files) {
      const documentType = detectDocumentType(file.mimetype);
      const { remotePath, url } = await uploadToBunny(
        file.buffer,
        file.originalname,
        directory,
        file.mimetype || 'application/octet-stream'
      );

      uploadedRemotePaths.push(remotePath);

      const [result] = await connection.execute(
        `
          INSERT INTO invoice_documents
            (invoice_type, invoice_id, document_name, document_type, storage_path, storage_url, uploaded_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        ['sales', invoice.id, file.originalname, documentType, remotePath, url, createdBy]
      );

      insertedRecords.push({
        id: result.insertId,
        invoice_type: 'sales',
        invoice_id: invoice.id,
        document_name: file.originalname,
        document_type: documentType,
        storage_path: remotePath,
        storage_url: url,
        uploaded_by: createdBy,
        created_at: new Date()
      });
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Documents uploaded successfully.',
      records: insertedRecords
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }

    for (const remotePath of uploadedRemotePaths) {
      try {
        await deleteFromBunny(remotePath);
      } catch (cleanupError) {
        console.error('Failed to cleanup Bunny file after invoice upload failure:', cleanupError.message);
      }
    }

    console.error('Error uploading sales invoice documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload sales invoice documents.',
      error: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.get('/documents/:document_id/download', async (req, res) => {
  try {
    const { document_id } = req.params;
    const [documents] = await req.db.execute(
      `
        SELECT id, document_name, storage_path
        FROM invoice_documents
        WHERE id = ? AND invoice_type = 'sales'
        LIMIT 1
      `,
      [document_id]
    );

    if (documents.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const document = documents[0];
    const file = await downloadFile(document.storage_path);

    res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
    if (file.contentLength) {
      res.setHeader('Content-Length', file.contentLength);
    }
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${document.document_name.replace(/"/g, '')}"`
    );

    res.send(file.data);
  } catch (error) {
    console.error('Error downloading sales invoice document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download the requested document.',
      error: error.message
    });
  }
});

router.delete('/documents/:document_id', async (req, res) => {
  try {
    const { document_id } = req.params;
    const [documents] = await req.db.execute(
      `
        SELECT id, document_name, storage_path
        FROM invoice_documents
        WHERE id = ? AND invoice_type = 'sales'
        LIMIT 1
      `,
      [document_id]
    );

    if (documents.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const document = documents[0];

    // Delete file from Bunny storage
    try {
      await deleteFromBunny(document.storage_path);
    } catch (error) {
      console.error('Failed to delete Bunny file for sales invoice document:', error.message);
      // Continue with database deletion even if file deletion fails
    }

    // Delete record from database
    await req.db.execute('DELETE FROM invoice_documents WHERE id = ?', [document_id]);

    res.json({
      success: true,
      message: 'Document deleted successfully.'
    });
  } catch (error) {
    console.error('Error deleting sales invoice document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete document.',
      error: error.message
    });
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
    
    // Get old invoice items to revert inventory changes
    const [oldItems] = await req.db.execute(
      'SELECT part_no, project_no, description, quantity FROM sales_tax_invoice_items WHERE invoice_id = ?',
      [id]
    );
    
    // Revert inventory changes from old items
    for (const oldItem of oldItems) {
      if (oldItem.part_no) {
        const oldQuantity = parseFloat(oldItem.quantity) || 0;
        
        // Find matching inventory record (FIFO - oldest first)
        const [inventoryItems] = await req.db.execute(`
          SELECT id, quantity, sold_quantity, balance, supplier_unit_price
          FROM inventory 
          WHERE project_no = ? AND part_no = ? AND description = ?
          ORDER BY created_at ASC
          LIMIT 1
        `, [oldItem.project_no || null, oldItem.part_no, oldItem.description || null]);
        
        if (inventoryItems.length > 0) {
          const inventoryItem = inventoryItems[0];
          const currentSoldQuantity = parseFloat(inventoryItem.sold_quantity) || 0;
          const currentQuantity = parseFloat(inventoryItem.quantity) || 0;
          const unitPrice = parseFloat(inventoryItem.supplier_unit_price) || 0;
          
          // Revert: reduce sold_quantity by old quantity
          const newSoldQuantity = Math.max(0, currentSoldQuantity - oldQuantity);
          const newBalance = currentQuantity - newSoldQuantity;
          const newBalanceAmount = newBalance * unitPrice;
          
          await req.db.execute(`
            UPDATE inventory 
            SET sold_quantity = ?,
                balance = ?,
                balance_amount = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [newSoldQuantity, newBalance, newBalanceAmount, inventoryItem.id]);
          
          console.log(`✓ Inventory reverted: project_no=${oldItem.project_no}, part_no=${oldItem.part_no}, sold_quantity: ${currentSoldQuantity} - ${oldQuantity} = ${newSoldQuantity}`);
        }
      }
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
      
      // Update inventory - Reduce stock
      // Match by project_no, part_no, and description (all three must match exactly)
      // If multiple matches exist, update only one record at a time according to FIFO
      if (item.part_no) {
        const saleQuantity = parseFloat(item.quantity) || 0;
        
        // Get matching inventory records (FIFO - oldest first)
        const [inventoryItems] = await req.db.execute(`
          SELECT id, quantity, sold_quantity, balance, supplier_unit_price, project_no, part_no, material_no, description
          FROM inventory 
          WHERE project_no = ? AND part_no = ? AND description = ?
          ORDER BY created_at ASC
          LIMIT 1
        `, [item.project_no || null, item.part_no, item.description || null]);
        
        if (inventoryItems.length > 0) {
          // Use FIFO - update the oldest matching record first (LIMIT 1 ensures only one record)
          const inventoryItem = inventoryItems[0];
          const currentSoldQuantity = parseFloat(inventoryItem.sold_quantity) || 0;
          const currentQuantity = parseFloat(inventoryItem.quantity) || 0;
          const currentBalance = parseFloat(inventoryItem.balance) || 0;
          const unitPrice = parseFloat(inventoryItem.supplier_unit_price) || 0;
          
          // Calculate available stock - always use quantity - sold_quantity to ensure accuracy
          const calculatedBalance = currentQuantity - currentSoldQuantity;
          const finalAvailableStock = calculatedBalance;
          
          // Check if there's enough stock before deducting to prevent negative inventory
          if (finalAvailableStock >= saleQuantity && finalAvailableStock > 0) {
            // Calculate new values
            const newSoldQuantity = currentSoldQuantity + saleQuantity;
            const newBalance = currentQuantity - newSoldQuantity;
            const newBalanceAmount = newBalance * unitPrice;
            
            // Update inventory record
            await req.db.execute(`
              UPDATE inventory 
              SET sold_quantity = ?,
                  balance = ?,
                  balance_amount = ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [newSoldQuantity, newBalance, newBalanceAmount, inventoryItem.id]);
            
            console.log(`✓ Inventory updated (FIFO): project_no=${item.project_no}, part_no=${item.part_no}, description=${item.description}, sold_quantity: ${currentSoldQuantity} + ${saleQuantity} = ${newSoldQuantity}`);
          } else {
            // Insufficient stock - skip this item
            console.log(`⚠️ Insufficient stock: Available=${finalAvailableStock}, Required=${saleQuantity}. Skipping inventory update for this item.`);
          }
        } else {
          // No matching inventory record found - skip this item
          console.log(`⚠️ No matching inventory found for project_no=${item.project_no}, part_no=${item.part_no}, description=${item.description}. Skipping inventory update for this item.`);
        }
      }
    }
    
    // ⚠️ AUTOMATIC TRIGGER: Recalculate delivered data for the PO if exists
    // Triggered when invoice items are updated
    // For sales tax invoices, only update customer POs (order_type = 'customer')
    if (customer_po_number) {
      try {
        const [pos] = await req.db.execute(
          'SELECT id FROM purchase_orders WHERE po_number = ? AND order_type = ? LIMIT 1',
          [customer_po_number, 'customer']
        );
        if (pos.length > 0) {
          // Wrap in try-catch to prevent failure of entire transaction if calculation fails
          try {
            await calculateAndUpdateDeliveredData(req.db, pos[0].id);
          } catch (calcError) {
            console.error('Error calculating delivered data (non-fatal):', calcError);
            // Don't throw - invoice update should succeed even if calculation fails
          }
        }
      } catch (poError) {
        console.error('Error finding PO for recalculation (non-fatal):', poError);
        // Don't throw - invoice update should succeed even if PO lookup fails
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
    // For sales tax invoices, only update customer POs (order_type = 'customer')
    if (invoice && invoice.customer_po_number) {
      try {
        const [pos] = await req.db.execute(
          'SELECT id FROM purchase_orders WHERE po_number = ? AND order_type = ? LIMIT 1',
          [invoice.customer_po_number, 'customer']
        );
        if (pos.length > 0) {
          // Wrap in try-catch to prevent failure of entire transaction if calculation fails
          try {
            await calculateAndUpdateDeliveredData(req.db, pos[0].id);
          } catch (calcError) {
            console.error('Error calculating delivered data (non-fatal):', calcError);
            // Don't throw - invoice deletion should succeed even if calculation fails
          }
        }
      } catch (poError) {
        console.error('Error finding PO for recalculation (non-fatal):', poError);
        // Don't throw - invoice deletion should succeed even if PO lookup fails
      }
    }
    
    res.json({ message: 'Sales tax invoice deleted successfully' });
  } catch (error) {
    console.error('Error deleting sales tax invoice:', error);
    res.status(500).json({ message: 'Error deleting sales tax invoice' });
  }
});

// GET /api/sales-tax-invoices/customer/:customer_id/po-numbers - Get approved PO numbers for customer
// Only show Purchase Orders with status "Partially Delivered" or "Approved"
// Do not include Purchase Orders with status "Delivered Completed"
router.get('/customer/:customer_id/po-numbers', async (req, res) => {
  try {
    const { customer_id } = req.params;
    
    // Get approved and partially delivered purchase orders for the customer
    const [pos] = await req.db.execute(`
      SELECT po.id, po.po_number, po.created_at
      FROM purchase_orders po
      WHERE po.customer_supplier_id = ? 
        AND po.order_type = 'customer' 
        AND po.status IN ('approved', 'partially_delivered')
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
    const excludeInvoiceId = req.query.exclude_invoice_id ? parseInt(req.query.exclude_invoice_id) : null;
    
    // Get purchase order items for the customer PO with already invoiced quantities
    let itemsQuery = `
      SELECT 
        poi.part_no, 
        poi.material_no, 
        poi.project_no, 
        poi.description, 
        poi.quantity, 
        poi.unit_price,
        COALESCE((
          SELECT SUM(stii.quantity)
          FROM sales_tax_invoice_items stii
          INNER JOIN sales_tax_invoices sti ON stii.invoice_id = sti.id
          WHERE sti.customer_po_number = ?
            AND stii.part_no = poi.part_no
            AND (stii.material_no = poi.material_no OR (stii.material_no IS NULL AND poi.material_no IS NULL))
            ${excludeInvoiceId ? 'AND sti.id != ?' : ''}
        ), 0) as already_invoiced_quantity
      FROM purchase_order_items poi
      INNER JOIN purchase_orders po ON poi.po_id = po.id
      WHERE po.po_number = ? AND po.order_type = 'customer'
    `;
    
    const queryParams = [po_number];
    if (excludeInvoiceId) {
      queryParams.push(excludeInvoiceId);
    }
    queryParams.push(po_number);
    
    const [items] = await req.db.execute(itemsQuery, queryParams);
    
    if (items.length === 0) {
      return res.status(404).json({ message: 'No items found for this customer PO number' });
    }
    
    // Calculate remaining quantity for each item
    const itemsWithRemaining = items.map(item => {
      const totalQuantity = parseFloat(item.quantity) || 0;
      const alreadyInvoiced = parseFloat(item.already_invoiced_quantity) || 0;
      const remainingQuantity = Math.max(0, totalQuantity - alreadyInvoiced);
      
      return {
        ...item,
        already_invoiced_quantity: alreadyInvoiced,
        remaining_quantity: remainingQuantity
      };
    });
    
    // Calculate total claim percentage from previous invoices for this PO (excluding current invoice if editing)
    let totalClaimQuery = `
      SELECT COALESCE(SUM(sti.claim_percentage), 0) as total_claim_percentage
      FROM sales_tax_invoices sti
      WHERE sti.customer_po_number = ?
    `;
    const totalClaimParams = [po_number];
    
    if (excludeInvoiceId) {
      totalClaimQuery += ' AND sti.id != ?';
      totalClaimParams.push(excludeInvoiceId);
    }
    
    const [totalClaimResult] = await req.db.execute(totalClaimQuery, totalClaimParams);
    const totalClaimPercentage = parseFloat(totalClaimResult[0]?.total_claim_percentage || 0);
    
    res.json({
      items: itemsWithRemaining,
      total_claim_percentage: totalClaimPercentage
    });
  } catch (error) {
    console.error('Error fetching customer PO items:', error);
    res.status(500).json({ message: 'Error fetching customer PO items' });
  }
});

// Function to generate HTML for Sales Tax Invoice PDF
function generateSalesInvoiceHTML(invoice, items, logoBase64 = null) {
  const formatCurrency = (amount) => {
    const numericAmount = Number(
      typeof amount === "string" ? amount.replace(/,/g, "") : amount
    );
    const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
    return `AED ${safeAmount.toLocaleString("en-AE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatNumber = (num) => {
    const numericAmount = Number(
      typeof num === "string" ? num.replace(/,/g, "") : num
    );
    const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
    return safeAmount.toLocaleString("en-AE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Convert number to words
  function numberToWords(num) {
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const thousands = ['', 'thousand', 'million', 'billion', 'trillion'];

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
    if (num < 0) return 'minus ' + numberToWords(Math.abs(num));

    let result = '';
    let thousandIndex = 0;

    while (num > 0) {
      if (num % 1000 !== 0) {
        result = convertHundreds(num % 1000) + (thousandIndex > 0 ? ' ' + thousands[thousandIndex] + ' ' : '') + result;
      }
      num = Math.floor(num / 1000);
      thousandIndex++;
    }

    return result.trim();
  }

  // Convert amount to words format
  const convertAmountToWords = (amount) => {
    const wholePart = Math.floor(amount);
    const decimalPart = Math.floor((amount % 1) * 100);
    const wholePartWords = numberToWords(wholePart);
    const capitalizedWords = wholePartWords.charAt(0).toUpperCase() + wholePartWords.slice(1);
    const decimalPartStr = decimalPart.toString().padStart(2, '0');
    return `AED ${capitalizedWords} and ${decimalPartStr}/100 Only`;
  };

  // Static seller info
  const sellerInfo = {
    company_name: "ALL TECH FOR HEAVY EQUIPMENT SPARE PARTS TRADING",
    address: "AL MA'MORAH, KHALIFA INDUSTRIAL ZONE 8 KEZAD, OFFICE IU-65",
    po_box: "P.O BOX 9026 ABU DHABI, UNITED ARAB EMIRATES",
    trn_number: "100477132300003",
    phone: "+971 50 621 3247",
    email: "Info@alltech-defence.ae"
  };

  // Bank account details
  const bankDetails = {
    account_name: "ALL TECH FOR HEAVY EQUIPMENT SPARE PARTS",
    account_number: "12025265820001",
    iban: "AE840030012000000000000",
    swift_code: "ADCBAEAXXXX",
    bank_name: "ABU DHABI COMMERCIAL BANK PJSC, KHALIFA CITY BRANCH, ABU DHABI - UNITED ARAB EMIRATES"
  };

  // Authorized signature
  const authorizedSignature = {
    name: "KHALED SALEH ABDULLA ALHAMMADI"
  };

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);
  const claimPercentage = invoice.claim_percentage || 100;
  const claimAmount = subtotal * (claimPercentage / 100);
  const vatAmount = claimAmount * 0.05;
  const grossTotal = claimAmount + vatAmount;

  // Format invoice date
  const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  // Format PO date
  const formatPODate = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  // Generate items table rows
  const itemsRows = items
    .map((item) => {
      return `
        <tr>
          <td>${item.quantity || ""}</td>
          <td>${item.part_no || ""}</td>
          <td>${item.material_no || ""}</td>
          <td>${item.description || ""}</td>
          <td>${formatCurrency(item.unit_price || 0)}</td>
          <td>${formatCurrency(item.total_amount || 0)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tax Invoice - ${invoice.invoice_number}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', 'Arial', 'Helvetica', sans-serif;
            color: #1a1a1a;
            background: #fff;
            padding: 20px;
            font-size: 13px;
            line-height: 1.5;
          }
          
          .sales-tax-invoice {
            max-width: 1200px;
            margin: 0 auto;
            background: #fff;
          }
          
          /* Top Header with Logo and Title */
          .invoice-top-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 18px;
            padding: 15px 0;
            border-bottom: 2px solid #2c3e50;
            position: relative;
          }
          
          .invoice-top-header::after {
            content: '';
            position: absolute;
            bottom: -2px;
            left: 0;
            width: 80px;
            height: 2px;
            background: #3498db;
          }
          
          .logo-section-left {
            flex: 0 0 auto;
          }
          
          .logo-container {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .alltech-logo-image {
            max-width: 220px;
            max-height: 120px;
            width: auto;
            height: auto;
            object-fit: contain;
            display: block;
            filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
          }
          
          .invoice-title-center {
            flex: 1;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            padding-left: 15px;
          }
          
          .tax-invoice-title {
            font-size: 28px;
            font-weight: 800;
            color: #2c3e50;
            margin: 0;
            letter-spacing: 3px;
            text-transform: uppercase;
            position: relative;
            padding: 0 15px;
          }
          
          .tax-invoice-title::before,
          .tax-invoice-title::after {
            content: '';
            position: absolute;
            top: 50%;
            width: 30px;
            height: 2px;
            background: #3498db;
          }
          
          .tax-invoice-title::before {
            left: 0;
          }
          
          .tax-invoice-title::after {
            right: 0;
          }
          
          /* Invoice Header */
          .invoice-header {
            margin-bottom: 15px;
            padding: 12px 15px;
            background: linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%);
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
          }
          
          .seller-info h4,
          .customer-info h4 {
            color: #2c3e50;
            font-weight: 700;
            font-size: 13px;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            padding-bottom: 6px;
            border-bottom: 2px solid #3498db;
            display: inline-block;
            min-width: 100px;
          }
          
          .company-details {
            font-size: 11.5px;
            line-height: 1.6;
            color: #34495e;
            padding-left: 3px;
          }
          
          .company-details strong {
            color: #2c3e50;
            font-weight: 700;
            display: block;
            margin-bottom: 2px;
          }
          
          .form-group {
            margin-bottom: 8px;
          }
          
          .form-group label {
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 4px;
            font-size: 10.5px;
            display: block;
            line-height: 1.4;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          
          .invoice-number-display,
          .customer-name-display,
          .po-number-display {
            padding: 6px 10px;
            font-weight: 600;
            color: #2c3e50;
            background: #ffffff;
            border: 1.5px solid #3498db;
            border-radius: 3px;
            font-size: 12px;
            min-height: 32px;
            line-height: 1.4;
            display: flex;
            align-items: center;
            box-shadow: 0 1px 2px rgba(52, 152, 219, 0.1);
          }
          
          /* Customer Section */
          .customer-section {
            margin-bottom: 15px;
            padding: 12px 15px;
            background: linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%);
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
          }
          
          .invoice-details {
            padding: 0;
          }
          
          .customer-details {
            margin-top: 8px;
            font-size: 11.5px;
            line-height: 1.6;
            color: #34495e;
            padding-left: 3px;
          }
          
          .customer-detail-row {
            margin-bottom: 5px;
            padding: 2px 0;
          }
          
          .customer-detail-row strong {
            color: #2c3e50;
            font-weight: 700;
            margin-right: 8px;
            min-width: 70px;
            display: inline-block;
          }
          
          /* Line Items Section */
          .line-items-section {
            margin-bottom: 15px;
          }
          
          .line-items-header {
            margin-bottom: 10px;
            padding-bottom: 6px;
            border-bottom: 1px solid #e0e0e0;
          }
          
          .line-items-header h4 {
            color: #2c3e50;
            font-weight: 700;
            font-size: 13px;
            margin-bottom: 5px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
          }
          
          .partial-delivery-note {
            font-size: 10.5px;
            color: #7f8c8d;
            font-style: italic;
            margin: 3px 0 0 0;
            padding-left: 3px;
          }
          
          .table-responsive {
            overflow: visible;
            border-radius: 4px;
            box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
          }
          
          .invoice-items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 0;
            background-color: white;
            border: 1px solid #2c3e50;
            border-radius: 4px;
            overflow: hidden;
          }
          
          .invoice-items-table thead {
            background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
            color: white;
          }
          
          .invoice-items-table thead th {
            border: 1px solid #1a252f;
            padding: 8px 6px;
            font-weight: 700;
            text-align: center;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: white;
            background: transparent;
          }
          
          .invoice-items-table tbody tr {
            transition: background-color 0.2s ease;
          }
          
          .invoice-items-table tbody tr:nth-child(even) {
            background-color: #f8f9fa;
          }
          
          .invoice-items-table tbody tr:hover {
            background-color: #e8f4f8;
          }
          
          .invoice-items-table tbody td {
            padding: 8px 6px;
            border: 1px solid #e0e0e0;
            text-align: center;
            font-size: 11px;
            color: #2c3e50;
            font-weight: 500;
          }
          
          .invoice-items-table tbody td:first-child {
            font-weight: 600;
          }
          
          .invoice-items-table tbody td:nth-last-child(2),
          .invoice-items-table tbody td:last-child {
            font-weight: 600;
            color: #2c3e50;
          }
          
          /* Financial Summary */
          .financial-summary {
            margin-bottom: 15px;
            padding: 12px 15px;
            background: linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%);
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
          }
          
          .calculations {
            font-size: 12.5px;
            max-width: 450px;
            margin-left: auto;
          }
          
          .calculation-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 0;
            border-bottom: 1px solid #e0e0e0;
          }
          
          .calculation-row:last-child {
            border-bottom: none;
          }
          
          .calculation-row.total {
            border-top: 2px solid #27ae60;
            margin-top: 8px;
            padding-top: 10px;
            padding-bottom: 4px;
            font-weight: 800;
            font-size: 15px;
            color: #27ae60;
            background: linear-gradient(to right, rgba(39, 174, 96, 0.05) 0%, transparent 100%);
            border-radius: 3px;
            padding-left: 8px;
            padding-right: 8px;
          }
          
          .calculation-row label {
            font-weight: 600;
            color: #2c3e50;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.3px;
          }
          
          .calculation-row span {
            font-weight: 700;
            color: #2c3e50;
            font-size: 12.5px;
          }
          
          .calculation-row.total label {
            font-size: 13px;
          }
          
          .calculation-row.total span {
            color: #27ae60;
            font-size: 16px;
          }
          
          /* Amount in Words */
          .amount-in-words-section {
            margin-bottom: 15px;
            padding: 12px 15px;
            background: linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%);
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
          }
          
          .amount-in-words-section h4 {
            color: #2c3e50;
            font-weight: 700;
            font-size: 13px;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            padding-bottom: 6px;
            border-bottom: 2px solid #3498db;
            display: inline-block;
          }
          
          .words-box {
            padding: 10px 12px;
            background: #ffffff;
            border: 2px solid #3498db;
            border-radius: 3px;
            font-size: 12.5px;
            font-weight: 600;
            color: #2c3e50;
            margin-top: 8px;
            box-shadow: 0 1px 4px rgba(52, 152, 219, 0.1);
            letter-spacing: 0.2px;
          }
          
          /* Bank Details and Signature */
          .bank-details-section {
            margin-bottom: 15px;
          }
          
          .bank-info h4,
          .signature-section h4 {
            color: #2c3e50;
            font-weight: 700;
            font-size: 13px;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            padding-bottom: 6px;
            border-bottom: 2px solid #3498db;
            display: inline-block;
          }
          
          .bank-box,
          .signature-box {
            padding: 12px;
            background: #ffffff;
            border: 2px solid #3498db;
            border-radius: 3px;
            font-size: 11.5px;
            line-height: 1.6;
            color: #34495e;
            margin-top: 8px;
            box-shadow: 0 1px 4px rgba(52, 152, 219, 0.1);
          }
          
          .bank-box div,
          .signature-box div {
            margin-bottom: 6px;
            padding: 2px 0;
          }
          
          .bank-box div:last-child,
          .signature-box div:last-child {
            margin-bottom: 0;
          }
          
          .bank-box strong,
          .signature-box strong {
            color: #2c3e50;
            font-weight: 700;
            margin-right: 8px;
            min-width: 120px;
            display: inline-block;
          }
          
          .signature-line,
          .stamp-line {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid #e0e0e0;
            font-weight: 500;
            color: #7f8c8d;
          }
          
          /* Footer */
          .footer-section {
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
          }
          
          .contact-info {
            display: flex;
            justify-content: center;
            gap: 30px;
            flex-wrap: wrap;
            margin-bottom: 12px;
          }
          
          .contact-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 11.5px;
            color: #34495e;
            font-weight: 500;
          }
          
          .contact-item i {
            color: #3498db;
            font-size: 12px;
          }
          
          .gradient-bar {
            height: 3px;
            background: linear-gradient(90deg, #3498db 0%, #2980b9 50%, #3498db 100%);
            margin-top: 12px;
            border-radius: 2px;
            box-shadow: 0 1px 3px rgba(52, 152, 219, 0.2);
          }
          
          @media print {
            @page {
              size: A4;
              margin: 10mm;
            }
            
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            
            body {
              background-color: white !important;
              padding: 15px;
              font-size: 12px;
            }
            
            .sales-tax-invoice {
              page-break-inside: avoid;
            }
            
            .invoice-top-header {
              page-break-after: avoid;
            }
            
            .invoice-header,
            .customer-section {
              page-break-inside: avoid;
            }
            
            .line-items-section {
              page-break-inside: auto;
            }
            
            .invoice-items-table {
              page-break-inside: auto;
              border-collapse: collapse;
            }
            
            .invoice-items-table thead {
              display: table-header-group;
              page-break-after: avoid;
            }
            
            .invoice-items-table tbody {
              display: table-row-group;
            }
            
            .invoice-items-table tbody tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            
            .invoice-items-table tbody td {
              page-break-inside: avoid;
            }
            
            .financial-summary,
            .amount-in-words-section,
            .bank-details-section {
              page-break-inside: avoid;
              page-break-before: auto;
            }
            
            .footer-section {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="sales-tax-invoice">
          <!-- Top Header with Logo and Title -->
          <div class="invoice-top-header">
            <div class="logo-section-left">
              <div class="logo-container">
                ${logoBase64 
                  ? `<img src="data:image/jpeg;base64,${logoBase64}" alt="ALL TECH DEFENCE Logo" class="alltech-logo-image" />`
                  : `<div style="width: 250px; height: 150px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border: 1px solid #ddd; border-radius: 4px;">
                      <span style="color: #999; font-size: 12px;">[LOGO]</span>
                    </div>`
                }
              </div>
            </div>
            <div class="invoice-title-center">
              <h1 class="tax-invoice-title" style="color: #2c3e50;">TAX INVOICE</h1>
            </div>
          </div>

          <!-- From and Customer Section - Side by Side -->
          <div class="invoice-header">
            <div style="display: flex; gap: 20px;">
              <div style="flex: 1;">
                <div class="seller-info">
                  <h4>From</h4>
                  <div class="company-details">
                    <strong>${sellerInfo.company_name}</strong><br />
                    ${sellerInfo.address}<br />
                    ${sellerInfo.po_box}<br />
                    <strong>TRN No.:</strong> ${sellerInfo.trn_number}<br />
                    <strong>Tel:</strong> ${sellerInfo.phone}<br />
                    <strong>Email:</strong> ${sellerInfo.email}
                  </div>
                </div>
              </div>
              <div style="flex: 1;">
                <div class="customer-info">
                  <h4>Customer</h4>
                  <div class="customer-details">
                    <div class="customer-detail-row">
                      <strong>Name:</strong> ${invoice.customer_name || 'N/A'}
                    </div>
                    <div class="customer-detail-row">
                      <strong>Address:</strong> ${invoice.customer_address || 'N/A'}
                    </div>
                    <div class="customer-detail-row">
                      <strong>TRN No.:</strong> ${invoice.customer_trn || 'N/A'}
                    </div>
                    <div class="customer-detail-row">
                      <strong>Tel:</strong> ${invoice.customer_phone || 'N/A'}
                    </div>
                    <div class="customer-detail-row">
                      <strong>Email:</strong> ${invoice.customer_email || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Invoice Details Section -->
          <div class="customer-section">
            <div class="invoice-details">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="form-group">
                  <label>Tax Invoice No:</label>
                  <div class="invoice-number-display">${invoice.invoice_number || 'N/A'}</div>
                </div>
                <div class="form-group">
                  <label>Invoice Date:</label>
                  <div class="invoice-number-display" style="font-weight: normal;">${formatDate(invoice.invoice_date)}</div>
                </div>
                <div class="form-group">
                  <label>Payment terms:</label>
                  <div class="invoice-number-display" style="font-weight: normal;">${invoice.payment_terms || 'N/A'}</div>
                </div>
                <div class="form-group">
                  <label>Contract No:</label>
                  <div class="invoice-number-display" style="font-weight: normal;">${invoice.contract_number || 'N/A'}</div>
                </div>
                <div class="form-group">
                  <label>PO No:</label>
                  <div class="invoice-number-display" style="font-weight: normal;">${invoice.customer_po_number || 'N/A'}</div>
                </div>
                <div class="form-group">
                  <label>PO Date:</label>
                  <div class="invoice-number-display" style="font-weight: normal;">${formatPODate(invoice.customer_po_date)}</div>
                </div>
                <div class="form-group">
                  <label>Delivery terms:</label>
                  <div class="invoice-number-display" style="font-weight: normal;">${invoice.delivery_terms || 'N/A'}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Line Items Table -->
          <div class="line-items-section">
            <div class="line-items-header">
              <h4>Line Items</h4>
              ${items.length > 0 ? `<p class="partial-delivery-note">Partial delivery of (${items.length}) Line items</p>` : ''}
            </div>
            <div class="table-responsive">
              <table class="invoice-items-table">
                <thead>
                  <tr>
                    <th>QTY</th>
                    <th>Part no.</th>
                    <th>Material no.</th>
                    <th>Description</th>
                    <th>Unit Price (AED)</th>
                    <th>Total Amount (AED)</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsRows}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Financial Summary -->
          <div class="financial-summary">
            <div class="calculations">
              <div class="calculation-row">
                <label>SUB TOTAL (AED):</label>
                <span>${formatCurrency(subtotal)}</span>
              </div>
              <div class="calculation-row">
                <label>Amount of c ${claimPercentage}% (AED):</label>
                <span>${formatCurrency(claimAmount)}</span>
              </div>
              <div class="calculation-row">
                <label>VAT (5%) (AED):</label>
                <span>${formatCurrency(vatAmount)}</span>
              </div>
              <div class="calculation-row total">
                <label>Gross Payable Amount (AED):</label>
                <span>${formatCurrency(grossTotal)}</span>
              </div>
            </div>
          </div>

          <!-- Amount in Words -->
          <div class="amount-in-words-section">
            <h4>Amount in Words</h4>
            <div class="words-box">
              ${convertAmountToWords(grossTotal)}
            </div>
          </div>

          <!-- Bank Account Details and Signature -->
          <div class="bank-details-section">
            <div style="display: flex; gap: 20px;">
              <div style="flex: 1;">
                <div class="bank-info">
                  <h4>Bank Account details</h4>
                  <div class="bank-box">
                    <div><strong>Account name:</strong> ${bankDetails.account_name}</div>
                    <div><strong>Account No (AED):</strong> ${bankDetails.account_number}</div>
                    <div><strong>IBAN No:</strong> ${bankDetails.iban}</div>
                    <div><strong>Swift Code:</strong> ${bankDetails.swift_code}</div>
                    <div><strong>Name of bank & Address:</strong> ${bankDetails.bank_name}</div>
                  </div>
                </div>
              </div>
              <div style="flex: 1;">
                <div class="signature-section">
                  <h4>Authorized Signature</h4>
                  <div class="signature-box">
                    <div><strong>NAME:</strong> ${authorizedSignature.name}</div>
                    <div class="signature-line">Signature: _________________</div>
                    <div class="stamp-line">Stamp: _________________</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer Contact Information -->
          <div class="footer-section">
            <div class="contact-info">
              <div class="contact-item">
                <i class="fas fa-envelope"></i>
                <span>Info@alltech-defence.ae</span>
              </div>
              <div class="contact-item">
                <i class="fas fa-box"></i>
                <span>Po. Box: 9026, Abu Dhabi, U.A.E.</span>
              </div>
              <div class="contact-item">
                <i class="fas fa-globe"></i>
                <span>www.alltech-defence.com</span>
              </div>
            </div>
            <div class="gradient-bar"></div>
          </div>
        </div>
      </body>
    </html>
  `;
}

// GET /api/sales-tax-invoices/:id/pdf - Generate PDF for invoice
router.get('/:id/pdf', async (req, res) => {
  let browser;
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
    
    const invoice = invoices[0];
    
    // Read logo file and convert to base64
    let logoBase64 = null;
    try {
      // Try multiple possible paths for the logo
      const possiblePaths = [
        path.join(__dirname, '../../frontend/src/components/SalesTaxInvoice/logo.jpeg'), // From backend/routes to root/frontend
        path.join(__dirname, '../frontend/src/components/SalesTaxInvoice/logo.jpeg'),   // Alternative path
        path.join(__dirname, '../../frontend/public/images/logo.jpeg'),                  // Public images folder
        path.join(__dirname, '../frontend/public/images/logo.jpeg'),                     // Alternative public path
        path.join(process.cwd(), 'frontend/src/components/SalesTaxInvoice/logo.jpeg'),   // From project root
        path.join(process.cwd(), 'frontend/public/images/logo.jpeg'),                      // From project root public
      ];
      
      for (const logoPath of possiblePaths) {
        if (fs.existsSync(logoPath)) {
          const logoBuffer = fs.readFileSync(logoPath);
          logoBase64 = logoBuffer.toString('base64');
          console.log(`Logo loaded from: ${logoPath}`);
          break;
        }
      }
      
      if (!logoBase64) {
        console.warn('Logo file not found in any of the expected locations. PDF will be generated without logo.');
      }
    } catch (logoError) {
      console.warn('Error loading logo file:', logoError.message);
      // Continue without logo
    }
    
    // Generate HTML for PDF
    const html = generateSalesInvoiceHTML(invoice, items, logoBase64);
    
    // Launch browser with args optimized for containerized environments
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Generate PDF
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
    
    // Close browser before sending response
    await browser.close();
    browser = null;
    
    // Validate PDF buffer
    if (!pdf || pdf.length === 0) {
      throw new Error('Generated PDF is empty');
    }
    
    // Ensure PDF is a proper Buffer
    const pdfBuffer = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
    
    // Validate buffer size
    if (pdfBuffer.length === 0) {
      throw new Error('PDF buffer is empty');
    }
    
    // Verify PDF magic number
    const pdfHeader = pdfBuffer.slice(0, 4).toString('ascii');
    if (pdfHeader !== '%PDF') {
      throw new Error('Generated file is not a valid PDF');
    }
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Sales_Tax_Invoice_${invoice.invoice_number}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    // Send PDF buffer
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    console.error('Error stack:', error.stack);
    // Make sure browser is closed even on error
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
    // Return error response
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Error generating PDF',
        error: error.message 
      });
    }
  }
});

module.exports = router;




