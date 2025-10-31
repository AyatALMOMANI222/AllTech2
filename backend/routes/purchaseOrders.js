const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const cleanName = file.originalname.replace(/[^\w\s.-]/gi, '');
    const timestamp = Date.now();
    const extension = path.extname(cleanName);
    const baseName = path.basename(cleanName, extension);
    cb(null, `${timestamp}-${baseName}${extension}`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /\.(xlsx|xls|csv)$/i;
    if (allowedTypes.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel and CSV files are allowed'), false);
    }
  }
});

// Helper function to convert Excel date serial number to MySQL DATE format
function convertExcelDate(excelSerial) {
  if (!excelSerial || isNaN(excelSerial) || excelSerial <= 0) {
    return null;
  }
  
  let adjustedSerial = excelSerial;
  if (excelSerial > 59) {
    adjustedSerial = excelSerial - 1;
  }
  
  const excelEpoch = new Date(1900, 0, 1);
  const jsDate = new Date(excelEpoch.getTime() + (adjustedSerial - 1) * 24 * 60 * 60 * 1000);
  
  return jsDate.toISOString().split('T')[0];
}

// Helper function to generate next PO number in format: PO-YYYY-XXX
async function generatePONumber(db) {
  const currentYear = new Date().getFullYear();
  const prefix = `PO-${currentYear}-`;
  
  try {
    // Get all existing PO numbers for the current year
    const [existingPOs] = await db.execute(
      'SELECT po_number FROM purchase_orders WHERE po_number LIKE ? ORDER BY po_number DESC LIMIT 1',
      [`${prefix}%`]
    );
    
    let nextNumber = 1;
    
    if (existingPOs.length > 0) {
      // Extract the number from the last PO number
      const lastPO = existingPOs[0].po_number;
      const lastNumber = parseInt(lastPO.replace(prefix, '')) || 0;
      nextNumber = lastNumber + 1;
    }
    
    // Format as PO-YYYY-XXX where XXX is padded with zeros
    const poNumber = `${prefix}${String(nextNumber).padStart(3, '0')}`;
    
    return poNumber;
  } catch (error) {
    console.error('Error generating PO number:', error);
    // Fallback to timestamp-based number if error occurs
    return `${prefix}${String(Date.now() % 1000).padStart(3, '0')}`;
  }
}

// Validation middleware
const validatePurchaseOrder = [
  body('po_number').optional().isString().withMessage('PO Number must be a string'),
  body('order_type').isIn(['customer', 'supplier']).withMessage('Order type must be customer or supplier'),
  body('customer_supplier_id').optional().isString().withMessage('Customer/Supplier ID must be a string')
];

// GET /api/purchase-orders - Get all purchase orders
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, order_type, status } = req.query;
    
    let query = `
      SELECT po.*, 
             cs.company_name as customer_supplier_name,
             u1.username as created_by_name,
             u2.username as approved_by_name
      FROM purchase_orders po
      LEFT JOIN customers_suppliers cs ON po.customer_supplier_id = cs.id
      LEFT JOIN users u1 ON po.created_by = u1.id
      LEFT JOIN users u2 ON po.approved_by = u2.id
    `;
    
    let countQuery = 'SELECT COUNT(*) as total FROM purchase_orders po';
    let params = [];
    let conditions = [];
    
    if (order_type) {
      conditions.push('po.order_type = ?');
      params.push(order_type);
    }
    
    if (status) {
      conditions.push('po.status = ?');
      params.push(status);
    }
    
    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }
    
    query += ' ORDER BY po.created_at DESC';
    
    const offset = (page - 1) * limit;
    query += ` LIMIT ${limit} OFFSET ${offset}`;
    
    const [orders] = await req.db.execute(query, params);
    const [countResult] = await req.db.execute(countQuery, params);
    const total = countResult[0].total;
    
    res.json({
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ message: 'Error fetching purchase orders' });
  }
});

// GET /api/purchase-orders/:id - Get single purchase order with items
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get purchase order details
    const [orders] = await req.db.execute(`
      SELECT po.*, 
             cs.company_name as customer_supplier_name,
             u1.username as created_by_name,
             u2.username as approved_by_name
      FROM purchase_orders po
      LEFT JOIN customers_suppliers cs ON po.customer_supplier_id = cs.id
      LEFT JOIN users u1 ON po.created_by = u1.id
      LEFT JOIN users u2 ON po.approved_by = u2.id
      WHERE po.id = ?
    `, [id]);
    
    if (orders.length === 0) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }
    
    // Get purchase order items
    const [items] = await req.db.execute(`
      SELECT * FROM purchase_order_items WHERE po_id = ? ORDER BY id
    `, [id]);
    
    // Get documents
    const [documents] = await req.db.execute(`
      SELECT * FROM po_documents WHERE po_id = ? ORDER BY created_at DESC
    `, [id]);
    
    res.json({
      order: orders[0],
      items,
      documents
    });
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    res.status(500).json({ message: 'Error fetching purchase order' });
  }
});

// POST /api/purchase-orders - Create new purchase order
router.post('/', validatePurchaseOrder, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { 
      po_number, order_type, customer_supplier_id, items = [],
      penalty_percentage, due_date,
      delivered_quantity, delivered_unit_price, delivered_total_price
    } = req.body;
    
    // Auto-generate PO number if not provided
    const finalPONumber = po_number || await generatePONumber(req.db);
    
    let customerSupplierName = 'Unknown Customer/Supplier';
    let actualCustomerSupplierId = customer_supplier_id;
    
    if (customer_supplier_id) {
      // Get customer/supplier name
      const [customerSupplier] = await req.db.execute(
        'SELECT company_name FROM customers_suppliers WHERE id = ?',
        [customer_supplier_id]
      );
      
      if (customerSupplier.length === 0) {
        // For testing purposes, set to NULL if customer/supplier not found
        console.log(`Warning: Customer/Supplier with ID ${customer_supplier_id} not found, setting to NULL`);
        actualCustomerSupplierId = null;
      } else {
        customerSupplierName = customerSupplier[0].company_name;
      }
    } else {
      actualCustomerSupplierId = null;
    }
    
    // Create purchase order
    const createdBy = req.user?.id || null; // Use null if no user ID available
    const [result] = await req.db.execute(`
      INSERT INTO purchase_orders (po_number, order_type, customer_supplier_id, customer_supplier_name, created_by)
      VALUES (?, ?, ?, ?, ?)
    `, [finalPONumber, order_type, actualCustomerSupplierId, customerSupplierName, createdBy]);
    
    const poId = result.insertId;
    
    // Add items if provided
    if (items.length > 0) {
      for (const item of items) {
        const {
          serial_no, project_no, date_po, part_no, material_no,
          description, uom, quantity, unit_price, total_price, comments,
          lead_time, due_date, penalty_percentage, invoice_no,
          delivered_quantity, delivered_unit_price, delivered_total_price
        } = item;
        
        await req.db.execute(`
          INSERT INTO purchase_order_items (
            po_id, serial_no, project_no, date_po, part_no, material_no,
            description, uom, quantity, unit_price, total_price, comments,
            lead_time, due_date, penalty_percentage, penalty_amount, invoice_no, balance_quantity_undelivered,
            delivered_quantity, delivered_unit_price, delivered_total_price
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          poId, 
          serial_no || null, 
          project_no || null, 
          date_po || null, 
          part_no, 
          material_no,
          description || null, 
          uom || null, 
          parseFloat(quantity) || 0, 
          parseFloat(unit_price) || 0, 
          parseFloat(total_price) || (parseFloat(quantity) * parseFloat(unit_price)), 
          comments || null,
          lead_time || null,
          due_date || null,
          penalty_percentage ? parseFloat(penalty_percentage) : null,
          penalty_percentage && quantity ? (parseFloat(quantity) * parseFloat(penalty_percentage) / 100) : null,
          invoice_no || null,
          delivered_quantity && quantity ? (parseFloat(quantity) - parseFloat(delivered_quantity)) : null,
          delivered_quantity ? parseFloat(delivered_quantity) : null,
          delivered_unit_price ? parseFloat(delivered_unit_price) : null,
          delivered_total_price ? parseFloat(delivered_total_price) : null
        ]);
      }
    }
    
    res.status(201).json({
      message: 'Purchase order created successfully',
      id: poId,
      po_number: finalPONumber
    });
  } catch (error) {
    console.error('Error creating purchase order:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({ 
      message: 'Error creating purchase order',
      error: error.message 
    });
  }
});

// PUT /api/purchase-orders/:id - Update purchase order
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      po_number, order_type, customer_supplier_id, status, items = [],
      penalty_percentage, penalty_amount, due_date, balance_quantity_undelivered,
      delivered_quantity, delivered_unit_price, delivered_total_price
    } = req.body;
    
    // Validate required fields
    if (!po_number || !order_type) {
      return res.status(400).json({ 
        message: 'PO Number and Order Type are required' 
      });
    }
    
    // Validate order_type
    if (!['customer', 'supplier'].includes(order_type)) {
      return res.status(400).json({ 
        message: 'Order type must be customer or supplier' 
      });
    }
    
    // Validate status (only valid ENUM values are allowed)
    if (status && !['approved', 'partially_delivered', 'delivered_completed'].includes(status)) {
      return res.status(400).json({ 
        message: 'Status must be approved, partially_delivered, or delivered_completed' 
      });
    }
    
    // Get customer/supplier name if ID provided
    let customerSupplierName = null;
    let actualCustomerSupplierId = customer_supplier_id || null;
    
    if (customer_supplier_id) {
      try {
        const [customerSupplier] = await req.db.execute(
          'SELECT company_name FROM customers_suppliers WHERE id = ?',
          [customer_supplier_id]
        );
        
        if (customerSupplier.length > 0) {
          customerSupplierName = customerSupplier[0].company_name;
        } else {
          console.log(`Warning: Customer/Supplier with ID ${customer_supplier_id} not found`);
          actualCustomerSupplierId = null;
        }
      } catch (error) {
        console.error('Error fetching customer/supplier:', error);
        actualCustomerSupplierId = null;
      }
    }
    
    // Update purchase order
    const [result] = await req.db.execute(`
      UPDATE purchase_orders SET
        po_number = ?, 
        order_type = ?, 
        customer_supplier_id = ?, 
        customer_supplier_name = ?,
        ${status !== undefined ? 'status = ?,' : ''}
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, status !== undefined 
      ? [po_number, order_type, actualCustomerSupplierId, customerSupplierName, status, id]
      : [po_number, order_type, actualCustomerSupplierId, customerSupplierName, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }
    
    // Update penalty_percentage for all items if provided (regardless of status)
    if (penalty_percentage !== undefined && penalty_percentage !== null && penalty_percentage !== '') {
      console.log('Updating penalty_percentage for all items:', penalty_percentage);
      
      try {
        // Update penalty_percentage
        await req.db.execute(`
          UPDATE purchase_order_items SET
            penalty_percentage = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE po_id = ?
        `, [parseFloat(penalty_percentage), id]);
        
        console.log('✅ Updated penalty_percentage for all items');
        
        // Recalculate all delivered values (including penalty_amount)
        const { calculateAndUpdateDeliveredData } = require('./databaseDashboard');
        await calculateAndUpdateDeliveredData(req.db, id);
        
      } catch (updateError) {
        console.error('Error updating penalty_percentage:', updateError);
        // Don't fail the whole request, just log the error
      }
    }
    
    // Handle form-level fields for delivered status
    if (status === 'delivered_completed' && (due_date || delivered_quantity || delivered_unit_price || delivered_total_price)) {
      console.log('Updating existing items with form-level fields for delivered status');
      console.log('Form-level fields:', { penalty_percentage, due_date, delivered_quantity, delivered_unit_price, delivered_total_price });
      
      try {
        // Update existing items with form-level values for delivered status
        await req.db.execute(`
          UPDATE purchase_order_items SET
            balance_quantity_undelivered = CASE 
              WHEN ? IS NOT NULL AND quantity IS NOT NULL THEN (quantity - ?)
              ELSE balance_quantity_undelivered
            END,
            due_date = COALESCE(?, due_date),
            delivered_quantity = COALESCE(?, delivered_quantity),
            delivered_unit_price = COALESCE(?, delivered_unit_price),
            delivered_total_price = COALESCE(?, delivered_total_price),
            updated_at = CURRENT_TIMESTAMP
          WHERE po_id = ?
        `, [
          delivered_quantity ? parseFloat(delivered_quantity) : null,
          delivered_quantity ? parseFloat(delivered_quantity) : null,
          due_date || null,
          delivered_quantity ? parseFloat(delivered_quantity) : null,
          delivered_unit_price ? parseFloat(delivered_unit_price) : null,
          delivered_total_price ? parseFloat(delivered_total_price) : null,
          id
        ]);
        
        console.log('✅ Updated existing items with form-level fields');
      } catch (updateError) {
        console.error('Error updating existing items:', updateError);
        return res.status(500).json({ 
          message: 'Error updating existing items with form-level fields',
          error: updateError.message 
        });
      }
    }

    // Update items if provided
    if (items && items.length > 0) {
      try {
        console.log('Updating items for PO:', id);
        console.log('Form-level fields:', { penalty_percentage, due_date, delivered_quantity, delivered_unit_price, delivered_total_price });
        console.log('Status:', status);
        
        // Delete existing items
        await req.db.execute('DELETE FROM purchase_order_items WHERE po_id = ?', [id]);
        
        // Insert new items
        for (const item of items) {
          const {
            serial_no, project_no, date_po, part_no, material_no,
            description, uom, quantity, unit_price, total_price, comments,
            item_lead_time, item_due_date, item_penalty_percentage, item_penalty_amount, 
            invoice_no, item_balance_quantity_undelivered,
            delivered_quantity, delivered_unit_price, delivered_total_price
          } = item;
          
          // Validate required item fields
          if (!part_no || !material_no || !quantity || !unit_price) {
            console.error('Missing required item fields:', item);
            continue; // Skip invalid items
          }
          
          // For delivered status, use form-level values if item-level values are not provided
          const finalDueDate = item_due_date || due_date || null;
          const finalPenaltyPercentage = item_penalty_percentage || penalty_percentage || null;
          const finalPenaltyAmount = item_penalty_amount || penalty_amount || null;
          const finalBalanceQuantityUndelivered = item_balance_quantity_undelivered || balance_quantity_undelivered || null;
          const finalDeliveredQuantity = delivered_quantity || null;
          const finalDeliveredUnitPrice = delivered_unit_price || null;
          const finalDeliveredTotalPrice = delivered_total_price || null;
          
          console.log('Item:', part_no, 'Final values:', { 
            finalDueDate, finalPenaltyPercentage, 
            finalPenaltyAmount, finalBalanceQuantityUndelivered,
            finalDeliveredQuantity, finalDeliveredUnitPrice, finalDeliveredTotalPrice
          });
          
          await req.db.execute(`
            INSERT INTO purchase_order_items (
              po_id, serial_no, project_no, date_po, part_no, material_no,
              description, uom, quantity, unit_price, total_price, comments,
              due_date, penalty_percentage, penalty_amount, invoice_no, balance_quantity_undelivered,
              delivered_quantity, delivered_unit_price, delivered_total_price
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            id, 
            serial_no || null, 
            project_no || null, 
            date_po || null, 
            part_no, 
            material_no,
            description || null, 
            uom || null, 
            parseFloat(quantity) || 0, 
            parseFloat(unit_price) || 0, 
            parseFloat(total_price) || (parseFloat(quantity) * parseFloat(unit_price)), 
            comments || null,
            finalDueDate,
            finalPenaltyPercentage ? parseFloat(finalPenaltyPercentage) : null,
            finalPenaltyAmount ? parseFloat(finalPenaltyAmount) : null,
            invoice_no || null,
            finalBalanceQuantityUndelivered ? parseFloat(finalBalanceQuantityUndelivered) : null,
            finalDeliveredQuantity ? parseFloat(finalDeliveredQuantity) : null,
            finalDeliveredUnitPrice ? parseFloat(finalDeliveredUnitPrice) : null,
            finalDeliveredTotalPrice ? parseFloat(finalDeliveredTotalPrice) : null
          ]);
        }
        
        // Update total amount
        const [totalResult] = await req.db.execute(`
          SELECT SUM(total_price) as total FROM purchase_order_items WHERE po_id = ?
        `, [id]);
        
        const totalAmount = totalResult[0].total || 0;
        await req.db.execute(`
          UPDATE purchase_orders SET total_amount = ? WHERE id = ?
        `, [totalAmount, id]);
        
      } catch (itemError) {
        console.error('Error updating items:', itemError);
        return res.status(500).json({ 
          message: 'Error updating purchase order items',
          error: itemError.message 
        });
      }
    }
    
    res.json({ 
      message: 'Purchase order updated successfully',
      id: id,
      affectedRows: result.affectedRows
    });
    
  } catch (error) {
    console.error('Error updating purchase order:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({ 
      message: 'Error updating purchase order',
      error: error.message,
      details: {
        code: error.code,
        sqlState: error.sqlState
      }
    });
  }
});

// DELETE /api/purchase-orders/:id - Delete purchase order
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await req.db.execute('DELETE FROM purchase_orders WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }
    
    res.json({ message: 'Purchase order deleted successfully' });
  } catch (error) {
    console.error('Error deleting purchase order:', error);
    res.status(500).json({ message: 'Error deleting purchase order' });
  }
});

// POST /api/purchase-orders/import - Import PO data from Excel
router.post('/import', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('File upload error:', err);
      return res.status(400).json({ 
        message: 'File upload failed', 
        error: err.message 
      });
    }
    next();
  });
}, async (req, res) => {
  let filePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    filePath = req.file.path;
    console.log('Processing PO file:', filePath);
    
    let data;
    const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
    
    if (fileExtension === 'csv') {
      const csvContent = fs.readFileSync(filePath, 'utf8');
      const lines = csvContent.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      data = lines.slice(1).filter(line => line.trim()).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = values[index] || '';
        });
        return obj;
      });
    } else {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = xlsx.utils.sheet_to_json(worksheet);
    }
    
    const processedItems = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        // Handle both header formats
        const {
          serial_no = row.serial_no || row.po_number,
          project_no = row.project_no,
          date_po = row.date_po || row['date p.o'] || row['DATE P.O'],
          part_no = row.part_no,
          material_no = row.material_no,
          description = row.description,
          uom = row.uom,
          quantity = row.quantity,
          unit_price = row.unit_price || row.supplier_unit_price || row.customer_unit_price,
          total_price = row.total_price,
          lead_time = row.lead_time || row['lead time'] || row['LEAD TIME'],
          due_date = row.due_date || row['due date'] || row['DUE DATE'],
          penalty_percentage = row.penalty_percentage || row['penalty %'] || row['PENALTY %'],
          penalty_amount = row.penalty_amount || row['penalty amount'] || row['PENALTY AMOUNT'],
          invoice_no = row.invoice_no || row['invoice no'] || row['INVOICE NO'],
          balance_quantity_undelivered = row.balance_quantity_undelivered || row['balance quantity undelivered'] || row['BALANCE QUANTITY UNDELIVERED'],
          comments = row.comments
        } = row;
        
        // Convert Excel date if needed
        let formattedDatePo = null;
        if (date_po) {
          if (!isNaN(date_po) && date_po > 0) {
            formattedDatePo = convertExcelDate(date_po);
          } else if (typeof date_po === 'string') {
            const parsedDate = new Date(date_po);
            if (!isNaN(parsedDate.getTime())) {
              formattedDatePo = parsedDate.toISOString().split('T')[0];
            }
          }
        }
        
        // Handle due_date conversion
        let formattedDueDate = null;
        if (due_date) {
          if (!isNaN(due_date) && due_date > 0) {
            formattedDueDate = convertExcelDate(due_date);
          } else if (typeof due_date === 'string') {
            const parsedDate = new Date(due_date);
            if (!isNaN(parsedDate.getTime())) {
              formattedDueDate = parsedDate.toISOString().split('T')[0];
            }
          }
        }

        processedItems.push({
          serial_no: serial_no || '',
          project_no: project_no || '',
          date_po: formattedDatePo,
          part_no: part_no || '',
          material_no: material_no || '',
          description: description || '',
          uom: uom || '',
          quantity: parseFloat(quantity) || 0,
          unit_price: parseFloat(unit_price) || 0,
          total_price: parseFloat(total_price) || 0,
          lead_time: lead_time || '',
          due_date: formattedDueDate,
          penalty_percentage: penalty_percentage ? parseFloat(penalty_percentage) : null,
          penalty_amount: penalty_amount ? parseFloat(penalty_amount) : null,
          invoice_no: invoice_no || null,
          balance_quantity_undelivered: balance_quantity_undelivered ? parseFloat(balance_quantity_undelivered) : null,
          comments: comments || ''
        });
      } catch (error) {
        console.error(`Error processing row ${i + 1}:`, error);
      }
    }
    
    // Clean up uploaded file
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('File cleaned up:', filePath);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up file:', cleanupError);
    }
    
    res.json({
      message: `Import completed. ${processedItems.length} items processed.`,
      items: processedItems
    });
  } catch (error) {
    console.error('Error importing PO data:', error);
    
    if (filePath) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (cleanupError) {
        console.error('Error cleaning up file after error:', cleanupError);
      }
    }
    
    res.status(500).json({ 
      message: 'Error importing PO data',
      error: error.message 
    });
  }
});

// GET /api/purchase-orders/customers-suppliers - Get customers and suppliers
router.get('/customers-suppliers/list', async (req, res) => {
  try {
    const { type } = req.query;
    
    let query = 'SELECT id, company_name, type FROM customers_suppliers';
    let params = [];
    
    if (type) {
      query += ' WHERE type = ?';
      params.push(type);
    }
    
    query += ' ORDER BY company_name';
    
    const [customersSuppliers] = await req.db.execute(query, params);
    res.json(customersSuppliers);
  } catch (error) {
    console.error('Error fetching customers/suppliers:', error);
    res.status(500).json({ message: 'Error fetching customers/suppliers' });
  }
});

// GET /api/purchase-orders/next-po-number - Get the next available PO number
router.get('/next-po-number', async (req, res) => {
  try {
    const poNumber = await generatePONumber(req.db);
    res.json({ po_number: poNumber });
  } catch (error) {
    console.error('Error generating PO number:', error);
    res.status(500).json({ 
      message: 'Error generating PO number',
      error: error.message 
    });
  }
});

module.exports = router;


