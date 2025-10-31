const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');

// Simple UUID v4 generator
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const router = express.Router();

// Get all customers/suppliers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { type, search } = req.query;
    let query = 'SELECT * FROM customers_suppliers WHERE 1=1';
    const params = [];

    if (type && (type === 'customer' || type === 'supplier')) {
      query += ' AND type = ?';
      params.push(type);
    }

    if (search) {
      query += ' AND (company_name LIKE ? OR contact_person LIKE ? OR email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY created_at DESC';

    const [records] = await req.db.execute(query, params);
    res.json({ records });
  } catch (error) {
    console.error('Get customers/suppliers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get customer/supplier by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [records] = await req.db.execute(
      'SELECT * FROM customers_suppliers WHERE id = ?',
      [id]
    );

    if (records.length === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }

    res.json({ record: records[0] });
  } catch (error) {
    console.error('Get customer/supplier error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new customer/supplier
router.post('/', authenticateToken, [
  body('type').isIn(['customer', 'supplier']).withMessage('Type must be customer or supplier'),
  body('companyName').notEmpty().withMessage('Company name is required'),
  body('address').optional().isString(),
  body('trnNumber').optional().isString(),
  body('contactPerson').optional().isString(),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('phone').optional().isString(),
  body('documentAttachment').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      type,
      companyName,
      address,
      trnNumber,
      contactPerson,
      email,
      phone,
      documentAttachment
    } = req.body;

    const id = generateUUID();

    await req.db.execute(
      `INSERT INTO customers_suppliers 
       (id, type, company_name, address, trn_number, contact_person, email, phone, document_attachment) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, type, companyName, address || null, trnNumber || null, contactPerson || null, 
       email || null, phone || null, documentAttachment || null]
    );

    res.status(201).json({
      message: 'Record created successfully',
      record: {
        id,
        type,
        companyName,
        address,
        trnNumber,
        contactPerson,
        email,
        phone,
        documentAttachment
      }
    });
  } catch (error) {
    console.error('Create customer/supplier error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update customer/supplier
router.put('/:id', authenticateToken, [
  body('type').optional().isIn(['customer', 'supplier']).withMessage('Type must be customer or supplier'),
  body('companyName').optional().notEmpty().withMessage('Company name cannot be empty'),
  body('address').optional().isString(),
  body('trnNumber').optional().isString(),
  body('contactPerson').optional().isString(),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('phone').optional().isString(),
  body('documentAttachment').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const {
      type,
      companyName,
      address,
      trnNumber,
      contactPerson,
      email,
      phone,
      documentAttachment
    } = req.body;

    // Check if record exists
    const [existingRecords] = await req.db.execute(
      'SELECT * FROM customers_suppliers WHERE id = ?',
      [id]
    );

    if (existingRecords.length === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (type) {
      updates.push('type = ?');
      values.push(type);
    }
    if (companyName) {
      updates.push('company_name = ?');
      values.push(companyName);
    }
    if (address !== undefined) {
      updates.push('address = ?');
      values.push(address);
    }
    if (trnNumber !== undefined) {
      updates.push('trn_number = ?');
      values.push(trnNumber);
    }
    if (contactPerson !== undefined) {
      updates.push('contact_person = ?');
      values.push(contactPerson);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }
    if (documentAttachment !== undefined) {
      updates.push('document_attachment = ?');
      values.push(documentAttachment);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    values.push(id);

    await req.db.execute(
      `UPDATE customers_suppliers SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({ message: 'Record updated successfully' });
  } catch (error) {
    console.error('Update customer/supplier error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete customer/supplier with cascade
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if record exists
    const [records] = await req.db.execute(
      'SELECT * FROM customers_suppliers WHERE id = ?',
      [id]
    );

    if (records.length === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }

    // CASCADE DELETE: Delete all related records in the correct order
    
    // 1. Get all related purchase orders
    const [relatedPOs] = await req.db.execute(
      'SELECT id FROM purchase_orders WHERE customer_supplier_id = ?',
      [id]
    );

    // Delete purchase order items first (child records)
    for (const po of relatedPOs) {
      await req.db.execute(
        'DELETE FROM purchase_order_items WHERE po_id = ?',
        [po.id]
      );
    }

    // Delete purchase orders
    await req.db.execute(
      'DELETE FROM purchase_orders WHERE customer_supplier_id = ?',
      [id]
    );

    // 2. Get all related sales tax invoices
    const [relatedSalesInvoices] = await req.db.execute(
      'SELECT id FROM sales_tax_invoices WHERE customer_id = ?',
      [id]
    );

    // Delete sales tax invoice items first (child records)
    for (const invoice of relatedSalesInvoices) {
      await req.db.execute(
        'DELETE FROM sales_tax_invoice_items WHERE invoice_id = ?',
        [invoice.id]
      );
    }

    // Delete sales tax invoices
    await req.db.execute(
      'DELETE FROM sales_tax_invoices WHERE customer_id = ?',
      [id]
    );

    // 3. Get all related purchase tax invoices
    const [relatedPurchaseInvoices] = await req.db.execute(
      'SELECT id FROM purchase_tax_invoices WHERE supplier_id = ?',
      [id]
    );

    // Delete purchase tax invoice items first (child records)
    for (const invoice of relatedPurchaseInvoices) {
      await req.db.execute(
        'DELETE FROM purchase_tax_invoice_items WHERE invoice_id = ?',
        [invoice.id]
      );
    }

    // Delete purchase tax invoices
    await req.db.execute(
      'DELETE FROM purchase_tax_invoices WHERE supplier_id = ?',
      [id]
    );

    // 4. Finally, delete the customer/supplier record
    await req.db.execute('DELETE FROM customers_suppliers WHERE id = ?', [id]);
    
    res.json({ 
      message: 'Record and all related data deleted successfully',
      deletedPurchaseOrders: relatedPOs.length,
      deletedSalesInvoices: relatedSalesInvoices.length,
      deletedPurchaseInvoices: relatedPurchaseInvoices.length
    });
  } catch (error) {
    console.error('Delete customer/supplier error:', error);
    console.error('Error details:', error.message);
    
    res.status(500).json({ 
      message: 'Server error', 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
});

module.exports = router;
