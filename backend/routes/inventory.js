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
    // Clean filename to avoid encoding issues
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
    // Accept only Excel and CSV files
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
  
  // Excel's epoch starts from 1900-01-01, but there's a leap year bug
  // Excel incorrectly treats 1900 as a leap year, so we need to adjust
  let adjustedSerial = excelSerial;
  if (excelSerial > 59) {
    adjustedSerial = excelSerial - 1; // Adjust for Excel's leap year bug
  }
  
  const excelEpoch = new Date(1900, 0, 1);
  const jsDate = new Date(excelEpoch.getTime() + (adjustedSerial - 1) * 24 * 60 * 60 * 1000);
  
  // Format as YYYY-MM-DD
  return jsDate.toISOString().split('T')[0];
}

// Validation middleware
const validateInventoryItem = [
  body('serial_no').optional().isString().trim(),
  body('project_no').optional().isString().trim(),
  body('date_po').optional().isISO8601().toDate(),
  body('part_no').optional().isString().trim(),
  body('material_no').optional().isString().trim(),
  body('description').optional().isString().trim(),
  body('uom').optional().isString().trim(),
  body('quantity').optional().isNumeric(),
  body('supplier_unit_price').optional().isNumeric(),
  body('total_price').optional().isNumeric(),
  body('sold_quantity').optional().isNumeric(),
  body('balance').optional().isNumeric(),
  body('balance_amount').optional().isNumeric()
];

// GET /api/inventory - Get all inventory items with filtering
router.get('/', async (req, res) => {
  try {
    const { search, page = 1, limit = 50, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;
    
    let query = 'SELECT * FROM inventory';
    let countQuery = 'SELECT COUNT(*) as total FROM inventory';
    let params = [];
    
    // Add search filter
    if (search) {
      const searchCondition = `WHERE serial_no LIKE ? OR project_no LIKE ? OR part_no LIKE ? OR material_no LIKE ? OR description LIKE ?`;
      query += ` ${searchCondition}`;
      countQuery += ` ${searchCondition}`;
      const searchParam = `%${search}%`;
      params = [searchParam, searchParam, searchParam, searchParam, searchParam];
    }
    
    // Add sorting
    query += ` ORDER BY ${sortBy} ${sortOrder}`;
    
    // Add pagination
    const offset = (page - 1) * limit;
    query += ` LIMIT ${limit} OFFSET ${offset}`;
    
    const [items] = await req.db.execute(query, params);
    const [countResult] = await req.db.execute(countQuery, params);
    const total = countResult[0].total;
    
    res.json({
      items,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ message: 'Error fetching inventory items' });
  }
});

// GET /api/inventory/:id - Get single inventory item
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [items] = await req.db.execute('SELECT * FROM inventory WHERE id = ?', [id]);
    
    if (items.length === 0) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }
    
    res.json(items[0]);
  } catch (error) {
    console.error('Error fetching inventory item:', error);
    res.status(500).json({ message: 'Error fetching inventory item' });
  }
});

// POST /api/inventory - Create new inventory item
router.post('/', validateInventoryItem, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const {
      serial_no, project_no, date_po, part_no, material_no, description,
      uom, quantity, supplier_unit_price
    } = req.body;
    
    // Parse numeric values
    const parsedQuantity = parseFloat(quantity) || 0;
    const parsedUnitPrice = parseFloat(supplier_unit_price) || 0;
    
    // AUTOMATIC CALCULATIONS
    // 1. total_price = quantity × supplier_unit_price
    const calculatedTotalPrice = parsedQuantity * parsedUnitPrice;
    
    // 2. sold_quantity = 0 (initial value for new inventory)
    const calculatedSoldQuantity = 0;
    
    // 3. balance = quantity - sold_quantity (equals quantity initially)
    const calculatedBalance = parsedQuantity - calculatedSoldQuantity;
    
    // 4. balance_amount = balance × supplier_unit_price
    const calculatedBalanceAmount = calculatedBalance * parsedUnitPrice;
    
    const [result] = await req.db.execute(`
      INSERT INTO inventory (
        serial_no, project_no, date_po, part_no, material_no, description,
        uom, quantity, supplier_unit_price, total_price, sold_quantity, balance, balance_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      serial_no, 
      project_no, 
      date_po, 
      part_no, 
      material_no, 
      description,
      uom, 
      parsedQuantity, 
      parsedUnitPrice, 
      calculatedTotalPrice, 
      calculatedSoldQuantity, 
      calculatedBalance, 
      calculatedBalanceAmount
    ]);
    
    console.log(`✓ Inventory item created: part_no=${part_no}, material_no=${material_no}, quantity=${parsedQuantity}, balance=${calculatedBalance}, total_price=${calculatedTotalPrice.toFixed(2)}`);
    
    res.status(201).json({
      message: 'Inventory item created successfully',
      id: result.insertId,
      calculated_values: {
        total_price: calculatedTotalPrice,
        sold_quantity: calculatedSoldQuantity,
        balance: calculatedBalance,
        balance_amount: calculatedBalanceAmount
      }
    });
  } catch (error) {
    console.error('Error creating inventory item:', error);
    res.status(500).json({ message: 'Error creating inventory item' });
  }
});

// PUT /api/inventory/:id - Update inventory item
router.put('/:id', validateInventoryItem, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { id } = req.params;
    const {
      serial_no, project_no, date_po, part_no, material_no, description,
      uom, quantity, supplier_unit_price, sold_quantity
    } = req.body;
    
    // Parse numeric values
    const parsedQuantity = parseFloat(quantity) || 0;
    const parsedUnitPrice = parseFloat(supplier_unit_price) || 0;
    const parsedSoldQuantity = parseFloat(sold_quantity) || 0;
    
    // AUTOMATIC CALCULATIONS
    // 1. total_price = quantity × supplier_unit_price
    const calculatedTotalPrice = parsedQuantity * parsedUnitPrice;
    
    // 2. balance = quantity - sold_quantity
    const calculatedBalance = parsedQuantity - parsedSoldQuantity;
    
    // 3. balance_amount = balance × supplier_unit_price
    const calculatedBalanceAmount = calculatedBalance * parsedUnitPrice;
    
    const [result] = await req.db.execute(`
      UPDATE inventory SET
        serial_no = ?, project_no = ?, date_po = ?, part_no = ?, material_no = ?, description = ?,
        uom = ?, quantity = ?, supplier_unit_price = ?, total_price = ?, sold_quantity = ?, balance = ?, balance_amount = ?
      WHERE id = ?
    `, [
      serial_no, 
      project_no, 
      date_po, 
      part_no, 
      material_no, 
      description,
      uom, 
      parsedQuantity, 
      parsedUnitPrice, 
      calculatedTotalPrice, 
      parsedSoldQuantity, 
      calculatedBalance, 
      calculatedBalanceAmount, 
      id
    ]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }
    
    console.log(`✓ Inventory item updated: id=${id}, quantity=${parsedQuantity}, sold_quantity=${parsedSoldQuantity}, balance=${calculatedBalance}, total_price=${calculatedTotalPrice.toFixed(2)}`);
    
    res.json({ 
      message: 'Inventory item updated successfully',
      calculated_values: {
        total_price: calculatedTotalPrice,
        balance: calculatedBalance,
        balance_amount: calculatedBalanceAmount
      }
    });
  } catch (error) {
    console.error('Error updating inventory item:', error);
    res.status(500).json({ message: 'Error updating inventory item' });
  }
});

// DELETE /api/inventory/:id - Delete inventory item
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await req.db.execute('DELETE FROM inventory WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }
    
    res.json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    res.status(500).json({ message: 'Error deleting inventory item' });
  }
});

// POST /api/inventory/import - Import inventory from Excel/CSV
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
  let connection = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    filePath = req.file.path;
    console.log('Processing file:', filePath);
    
    let data;
    const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
    
    if (fileExtension === 'csv') {
      // Handle CSV files
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
      // Handle Excel files
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = xlsx.utils.sheet_to_json(worksheet);
    }
    
    // Get database connection for transaction
    connection = await req.db.getConnection();
    await connection.beginTransaction();
    
    const insertedItems = [];
    const updatedItems = [];
    const skippedItems = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        const {
          serial_no, project_no, date_po, part_no, material_no, description,
          uom, quantity, supplier_unit_price, unit_price, total_price, sold_quantity, balance, balance_amount
        } = row;
        
        // Skip rows without essential data
        if (!part_no || !material_no) {
          skippedItems.push({ 
            row: i + 1, 
            reason: 'Missing part_no or material_no', 
            data: row 
          });
          continue;
        }
        
        // Convert Excel date serial number to MySQL DATE format
        let formattedDatePo = null;
        if (date_po) {
          if (!isNaN(date_po) && date_po > 0) {
            formattedDatePo = convertExcelDate(date_po);
            console.log(`Converted Excel date ${date_po} to: ${formattedDatePo}`);
          } else if (typeof date_po === 'string') {
            const parsedDate = new Date(date_po);
            if (!isNaN(parsedDate.getTime())) {
              formattedDatePo = parsedDate.toISOString().split('T')[0];
              console.log(`Parsed string date ${date_po} to: ${formattedDatePo}`);
            }
          }
        }
        
        // Parse numeric values
        // Support both 'unit_price' and 'supplier_unit_price' from Excel
        // Priority: unit_price > supplier_unit_price
        const importQuantity = parseFloat(quantity) || 0;
        const unitPrice = parseFloat(unit_price || supplier_unit_price) || 0;
        const importSoldQuantity = parseFloat(sold_quantity) || 0;
        
        // ⚠️ IMPORTANT: Check if item exists based on project_no, part_no, description, AND supplier_unit_price (unit_price)
        // Only update existing record if ALL four fields match exactly
        // Handle NULL values correctly for both project_no and description
        let existingItems;
        const projectNoForMatching = project_no || null;
        const descriptionForMatching = description || null;
        
        // Build WHERE clause condition based on NULL values
        let whereClause = '';
        let params = [];
        
        // Handle project_no
        if (!project_no || project_no === '' || project_no === null) {
          whereClause += '(project_no IS NULL OR project_no = \'\')';
        } else {
          whereClause += 'project_no = ?';
          params.push(projectNoForMatching);
        }
        
        // Add part_no (required)
        whereClause += ' AND part_no = ?';
        params.push(part_no);
        
        // Handle description
        if (!description || description === '' || description === null) {
          whereClause += ' AND (description IS NULL OR description = \'\')';
        } else {
          whereClause += ' AND description = ?';
          params.push(descriptionForMatching);
        }
        
        // Add supplier_unit_price (required)
        whereClause += ' AND supplier_unit_price = ?';
        params.push(unitPrice);
        
        [existingItems] = await connection.execute(`
          SELECT id, quantity, sold_quantity, supplier_unit_price
          FROM inventory 
          WHERE ${whereClause}
        `, params);
        
        if (existingItems.length > 0) {
          // Item EXISTS - UPDATE quantities and recalculate
          const existingItem = existingItems[0];
          const existingQuantity = parseFloat(existingItem.quantity) || 0;
          const existingSoldQuantity = parseFloat(existingItem.sold_quantity) || 0;
          
          // Increase quantity by imported amount
          const newQuantity = existingQuantity + importQuantity;
          
          // Recalculate balance and amounts
          const newBalance = newQuantity - existingSoldQuantity;
          const newTotalPrice = newQuantity * unitPrice;
          const newBalanceAmount = newBalance * unitPrice;
          
          // Update using the same matching criteria
          await connection.execute(`
            UPDATE inventory 
            SET quantity = ?,
                supplier_unit_price = ?,
                total_price = ?,
                balance = ?,
                balance_amount = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE ${whereClause}
          `, [
            newQuantity,
            unitPrice,
            newTotalPrice,
            newBalance,
            newBalanceAmount,
            ...params
          ]);
          
          updatedItems.push({
            row: i + 1,
            project_no: projectNoForMatching,
            part_no,
            description: description || '',
            unit_price: unitPrice,
            previous_quantity: existingQuantity,
            added_quantity: importQuantity,
            new_quantity: newQuantity,
            new_balance: newBalance
          });
          
          console.log(`✓ Updated: project_no=${projectNoForMatching}, part_no=${part_no}, description=${description || ''}, unit_price=${unitPrice}, quantity: ${existingQuantity} + ${importQuantity} = ${newQuantity}`);
          
        } else {
          // Item DOES NOT EXIST - INSERT new record
          const newQuantity = importQuantity;
          const newSoldQuantity = importSoldQuantity;
          const newBalance = newQuantity - newSoldQuantity;
          const newTotalPrice = newQuantity * unitPrice;
          const newBalanceAmount = newBalance * unitPrice;
          
          const [result] = await connection.execute(`
          INSERT INTO inventory (
            serial_no, project_no, date_po, part_no, material_no, description,
              uom, quantity, supplier_unit_price, total_price, sold_quantity,
              balance, balance_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            serial_no,
            project_no,
            formattedDatePo,
            part_no,
            material_no,
            description,
            uom,
            newQuantity,
            unitPrice,
            newTotalPrice,
            newSoldQuantity,
            newBalance,
            newBalanceAmount
          ]);
          
          insertedItems.push({
            row: i + 1,
            id: result.insertId,
            project_no: projectNoForMatching,
            part_no,
            description: description || '',
            unit_price: unitPrice,
            quantity: newQuantity,
            balance: newBalance
          });
          
          console.log(`✓ Created: project_no=${projectNoForMatching}, part_no=${part_no}, description=${description || ''}, unit_price=${unitPrice}, quantity=${newQuantity}`);
        }
        
      } catch (error) {
        // If any item fails, rollback and throw error
        console.error(`Error processing row ${i + 1}:`, error);
        throw new Error(`Row ${i + 1}: ${error.message}`);
      }
    }
    
    // Commit transaction
    await connection.commit();
    console.log('✓ Transaction committed successfully');
    
    // Clean up uploaded file
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('✓ File cleaned up:', filePath);
      }
    } catch (cleanupError) {
      console.error('Warning: Error cleaning up file:', cleanupError);
    }
    
    // Prepare response with summary message
    const totalProcessed = insertedItems.length + updatedItems.length;
    const response = {
      success: true,
      message: `Import completed successfully! ${totalProcessed} items processed.`,
      summary: {
        total_rows: data.length,
        records_updated: updatedItems.length,
        records_created: insertedItems.length,
        inserted: insertedItems.length,  // Keep for backward compatibility
        updated: updatedItems.length,    // Keep for backward compatibility
        skipped: skippedItems.length
      },
      summary_message: `Import Summary: ${updatedItems.length} inventory record(s) updated, ${insertedItems.length} inventory record(s) newly created.`,
      details: {
        inserted_items: insertedItems,
        updated_items: updatedItems,
        skipped_items: skippedItems.length > 0 ? skippedItems : undefined
      }
    };
    
    res.json(response);
    
  } catch (error) {
    // Rollback transaction on error
    if (connection) {
      try {
        await connection.rollback();
        console.log('✗ Transaction rolled back due to error');
      } catch (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError);
      }
    }
    
    console.error('Error importing inventory:', error);
    
    // Clean up file on error
    if (filePath) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log('✓ File cleaned up after error');
        }
      } catch (cleanupError) {
        console.error('Error cleaning up file after error:', cleanupError);
      }
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Error importing inventory data',
      error: error.message 
    });
    
  } finally {
    // Release database connection
    if (connection) {
      connection.release();
      console.log('✓ Database connection released');
    }
  }
});

module.exports = router;
