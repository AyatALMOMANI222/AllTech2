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

// Helper function to format date as YYYY-MM-DD using local date components (avoids timezone conversion)
function formatDateAsString(year, month, day) {
  const yyyy = String(year);
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Helper function to convert Excel date serial number to MySQL DATE format
function convertExcelDate(excelSerial) {
  if (!excelSerial || isNaN(excelSerial) || excelSerial <= 0) {
    return null;
  }
  
  // Excel's epoch starts from 1900-01-01 (serial number 1)
  // Excel incorrectly treats 1900 as a leap year, so we need to adjust for serial > 59
  // Use December 30, 1899 as the base epoch
  const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
  let adjustedSerial = excelSerial;
  if (excelSerial > 59) {
    adjustedSerial = excelSerial - 1; // Adjust for Excel's leap year bug
  }
  // Add days: serial 1 = Jan 1, 1900
  // Dec 30, 1899 + 2 days = Jan 1, 1900, so we add (adjustedSerial + 1) days
  const jsDate = new Date(excelEpoch.getTime() + (adjustedSerial + 1) * 24 * 60 * 60 * 1000);
  
  // Use local date components to avoid timezone conversion issues
  return formatDateAsString(jsDate.getFullYear(), jsDate.getMonth(), jsDate.getDate());
}

// Helper function to parse date from various formats
function parseDate(dateValue) {
  if (!dateValue) return null;
  
  // If it's already a Date object (xlsx might return this)
  if (dateValue instanceof Date) {
    if (!isNaN(dateValue.getTime())) {
      // Use local date components to preserve the exact date without timezone shift
      return formatDateAsString(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
    }
    return null;
  }
  
  // If it's already a date string in YYYY-MM-DD format
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }
  
  // If it's an Excel serial number
  if (typeof dateValue === 'number') {
    return convertExcelDate(dateValue);
  }
  
  // Try to parse as date string (MM/DD/YYYY or DD/MM/YYYY)
  if (typeof dateValue === 'string') {
    // Try MM/DD/YYYY format (US Excel standard format)
    const mmddyyyy = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mmddyyyy) {
      const first = parseInt(mmddyyyy[1]);
      const second = parseInt(mmddyyyy[2]);
      const year = parseInt(mmddyyyy[3]);
      
      let month, day;
      // Determine format: if first > 12, it must be DD/MM/YYYY (day)
      // If second > 12, it must be MM/DD/YYYY (day)
      // If both <= 12, assume MM/DD/YYYY (US format, standard in Excel)
      if (first > 12 && second <= 12) {
        // Definitely DD/MM/YYYY (first is day, second is month)
        day = first;
        month = second - 1;
      } else if (second > 12 && first <= 12) {
        // Definitely MM/DD/YYYY (first is month, second is day)
        month = first - 1;
        day = second;
      } else {
        // Ambiguous (both <= 12) - assume MM/DD/YYYY (US format, standard in Excel)
        month = first - 1;
        day = second;
      }
      
      // Use formatDateAsString to avoid timezone conversion
      return formatDateAsString(year, month, day);
    }
    
    // Try YYYY-MM-DD format (already handled above, but keep for clarity)
    const yyyymmdd = dateValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (yyyymmdd) {
      return dateValue;
    }
    
    // Try to parse as standard date string (handles various formats)
    // Note: For strings like "2024-01-15", new Date() interprets as UTC, so we handle YYYY-MM-DD above
    // For other formats, parse and use local date components
    const parsed = new Date(dateValue);
    if (!isNaN(parsed.getTime())) {
      // Use local date components to preserve the exact date without timezone shift
      return formatDateAsString(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
  }
  
  return null;
}

// Helper function to find column value by normalized name (case-insensitive, handles spaces/underscores)
function findColumnValue(row, columnName) {
  if (!row) return '';
  
  // Normalize the target column name: lowercase, replace underscores/spaces with single space, trim
  const normalizedTarget = columnName.toLowerCase().replace(/[_\s]+/g, ' ').trim();
  
  // First, try direct property access (most common cases)
  if (row[columnName] !== undefined) {
    return row[columnName];
  }
  
  // Try common variations
  const variations = [
    columnName,
    columnName.toLowerCase(),
    columnName.toUpperCase(),
    columnName.replace(/_/g, ' '),
    columnName.replace(/\s+/g, '_'),
    columnName.replace(/\s+/g, ' ').trim()
  ];
  
  for (const variation of variations) {
    if (row[variation] !== undefined) {
      return row[variation];
    }
  }
  
  // Search through all keys in the row with normalized comparison
  for (const key in row) {
    if (row.hasOwnProperty(key)) {
      const normalizedKey = key.toLowerCase().replace(/[_\s]+/g, ' ').trim();
      if (normalizedKey === normalizedTarget) {
        return row[key];
      }
    }
  }
  
  return '';
}

// Validation middleware
const validateWarranty = [
  body('sr_no')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === null || value === undefined || value === '') {
        return true;
      }
      // Accept string or number, convert to string
      return typeof value === 'string' || typeof value === 'number';
    })
    .withMessage('Sr. No must be a string or number'),
  body('part_no')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === null || value === undefined || value === '') {
        return true;
      }
      return typeof value === 'string' || typeof value === 'number';
    })
    .withMessage('Part No must be a string or number'),
  body('material_no')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === null || value === undefined || value === '') {
        return true;
      }
      return typeof value === 'string' || typeof value === 'number';
    })
    .withMessage('Material No must be a string or number'),
  body('description').optional({ nullable: true }).isString().withMessage('Description must be a string'),
  body('project_no')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === null || value === undefined || value === '') {
        return true;
      }
      return typeof value === 'string' || typeof value === 'number';
    })
    .withMessage('Project No must be a string or number'),
  body('part_cost').optional({ nullable: true }).isNumeric().withMessage('Part Cost must be a number'),
  body('serial_number')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === null || value === undefined || value === '') {
        return true;
      }
      return typeof value === 'string' || typeof value === 'number';
    })
    .withMessage('Serial Number must be a string or number'),
  body('warranty_start_date').optional({ nullable: true }).isISO8601().toDate().withMessage('Invalid warranty start date'),
  body('warranty_end_date').optional({ nullable: true }).isISO8601().toDate().withMessage('Invalid warranty end date'),
  body('remarks').optional({ nullable: true }).isString().withMessage('Remarks must be a string'),
  body('warranty_type').isIn(['sales', 'purchase']).withMessage('Warranty type must be sales or purchase'),
  body('linked_po_id').optional({ nullable: true }).isInt().withMessage('Linked PO ID must be an integer'),
  body('linked_invoice_id').optional({ nullable: true }).isInt().withMessage('Linked Invoice ID must be an integer'),
  body('linked_invoice_type').optional({ nullable: true }).isIn(['sales', 'purchase']).withMessage('Linked Invoice Type must be sales or purchase')
];

// GET /api/warranty - Get all warranty records
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, warranty_type, search } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(1000, parseInt(limit) || 50)); // Limit between 1 and 1000
    const offset = Math.max(0, (pageNum - 1) * limitNum);
    
    let query = 'SELECT * FROM warranty_management WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM warranty_management WHERE 1=1';
    let params = [];
    let conditions = [];
    
    if (warranty_type) {
      conditions.push('warranty_type = ?');
      params.push(warranty_type);
    }
    
    if (search) {
      conditions.push(`(
        sr_no LIKE ? OR 
        part_no LIKE ? OR 
        material_no LIKE ? OR 
        description LIKE ? OR 
        project_no LIKE ? OR 
        serial_number LIKE ?
      )`);
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
    }
    
    if (conditions.length > 0) {
      const whereClause = ' AND ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }
    
    // Use numbers directly in LIMIT/OFFSET (MySQL doesn't support placeholders for these)
    query += ` ORDER BY created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;
    
    const [records] = await req.db.execute(query, params);
    const [countResult] = await req.db.execute(countQuery, params);
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limitNum);
    
    res.json({
      records,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalRecords: total,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Error fetching warranty records:', error);
    res.status(500).json({ message: 'Error fetching warranty records', error: error.message });
  }
});

// GET /api/warranty/report - Get warranty report (items under warranty)
// ⚠️ IMPORTANT: This route must come BEFORE /:id route to avoid route conflicts
router.get('/report', async (req, res) => {
  try {
    const { as_of_date } = req.query;
    
    // If as_of_date is provided, use it; otherwise use current date
    const checkDate = as_of_date || new Date().toISOString().split('T')[0];
    
    // Query to get all items that are under warranty as of the check date
    // An item is under warranty if:
    // 1. warranty_start_date is not null
    // 2. warranty_end_date is not null
    // 3. checkDate >= warranty_start_date AND checkDate <= warranty_end_date
    const query = `
      SELECT 
        id,
        sr_no,
        part_no,
        material_no,
        description,
        project_no,
        part_cost,
        serial_number,
        warranty_start_date,
        warranty_end_date,
        remarks,
        warranty_type,
        linked_po_id,
        linked_invoice_id,
        linked_invoice_type,
        created_at,
        updated_at,
        DATEDIFF(warranty_end_date, ?) as days_remaining
      FROM warranty_management
      WHERE warranty_start_date IS NOT NULL
        AND warranty_end_date IS NOT NULL
        AND ? >= warranty_start_date
        AND ? <= warranty_end_date
      ORDER BY warranty_end_date ASC, warranty_start_date ASC
    `;
    
    const [records] = await req.db.execute(query, [checkDate, checkDate, checkDate]);
    
    // Get total count
    const [countResult] = await req.db.execute(`
      SELECT COUNT(*) as total
      FROM warranty_management
      WHERE warranty_start_date IS NOT NULL
        AND warranty_end_date IS NOT NULL
        AND ? >= warranty_start_date
        AND ? <= warranty_end_date
    `, [checkDate, checkDate]);
    
    const total = countResult[0].total;
    
    res.json({
      success: true,
      records,
      total,
      as_of_date: checkDate,
      pagination: {
        totalRecords: total
      }
    });
  } catch (error) {
    console.error('Error fetching warranty report:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching warranty report', 
      error: error.message 
    });
  }
});

// GET /api/warranty/:id - Get single warranty record
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [records] = await req.db.execute(
      'SELECT * FROM warranty_management WHERE id = ?',
      [id]
    );
    
    if (records.length === 0) {
      return res.status(404).json({ message: 'Warranty record not found' });
    }
    
    res.json({ record: records[0] });
  } catch (error) {
    console.error('Error fetching warranty record:', error);
    res.status(500).json({ message: 'Error fetching warranty record', error: error.message });
  }
});

// POST /api/warranty - Create new warranty record
router.post('/', validateWarranty, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const {
      sr_no,
      part_no,
      material_no,
      description,
      project_no,
      part_cost = 0,
      serial_number,
      warranty_start_date,
      warranty_end_date,
      remarks,
      warranty_type = 'sales',
      linked_po_id,
      linked_invoice_id,
      linked_invoice_type
    } = req.body;
    
    const createdBy = req.user?.id || null;
    
    // Convert numeric values to strings for text fields
    const srNoStr = sr_no !== null && sr_no !== undefined ? String(sr_no) : null;
    const partNoStr = part_no !== null && part_no !== undefined ? String(part_no) : null;
    const materialNoStr = material_no !== null && material_no !== undefined ? String(material_no) : null;
    const projectNoStr = project_no !== null && project_no !== undefined ? String(project_no) : null;
    const serialNumberStr = serial_number !== null && serial_number !== undefined ? String(serial_number) : null;
    
    const [result] = await req.db.execute(`
      INSERT INTO warranty_management (
        sr_no, part_no, material_no, description, project_no, part_cost,
        serial_number, warranty_start_date, warranty_end_date, remarks,
        warranty_type, linked_po_id, linked_invoice_id, linked_invoice_type, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      srNoStr,
      partNoStr,
      materialNoStr,
      description || null,
      projectNoStr,
      part_cost || 0,
      serialNumberStr,
      warranty_start_date || null,
      warranty_end_date || null,
      remarks || null,
      warranty_type,
      linked_po_id || null,
      linked_invoice_id || null,
      linked_invoice_type || null,
      createdBy
    ]);
    
    const [newRecord] = await req.db.execute(
      'SELECT * FROM warranty_management WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json({ 
      message: 'Warranty record created successfully',
      record: newRecord[0]
    });
  } catch (error) {
    console.error('Error creating warranty record:', error);
    res.status(500).json({ message: 'Error creating warranty record', error: error.message });
  }
});

// PUT /api/warranty/:id - Update warranty record
router.put('/:id', validateWarranty, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { id } = req.params;
    const {
      sr_no,
      part_no,
      material_no,
      description,
      project_no,
      part_cost,
      serial_number,
      warranty_start_date,
      warranty_end_date,
      remarks,
      warranty_type,
      linked_po_id,
      linked_invoice_id,
      linked_invoice_type
    } = req.body;
    
    // Check if record exists
    const [existing] = await req.db.execute(
      'SELECT id FROM warranty_management WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Warranty record not found' });
    }
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    
    // Convert numeric values to strings for text fields
    if (sr_no !== undefined) { 
      updates.push('sr_no = ?'); 
      values.push(sr_no !== null && sr_no !== undefined ? String(sr_no) : null); 
    }
    if (part_no !== undefined) { 
      updates.push('part_no = ?'); 
      values.push(part_no !== null && part_no !== undefined ? String(part_no) : null); 
    }
    if (material_no !== undefined) { 
      updates.push('material_no = ?'); 
      values.push(material_no !== null && material_no !== undefined ? String(material_no) : null); 
    }
    if (description !== undefined) { updates.push('description = ?'); values.push(description || null); }
    if (project_no !== undefined) { 
      updates.push('project_no = ?'); 
      values.push(project_no !== null && project_no !== undefined ? String(project_no) : null); 
    }
    if (part_cost !== undefined) { updates.push('part_cost = ?'); values.push(part_cost || 0); }
    if (serial_number !== undefined) { 
      updates.push('serial_number = ?'); 
      values.push(serial_number !== null && serial_number !== undefined ? String(serial_number) : null); 
    }
    if (warranty_start_date !== undefined) { updates.push('warranty_start_date = ?'); values.push(warranty_start_date || null); }
    if (warranty_end_date !== undefined) { updates.push('warranty_end_date = ?'); values.push(warranty_end_date || null); }
    if (remarks !== undefined) { updates.push('remarks = ?'); values.push(remarks || null); }
    if (warranty_type !== undefined) { updates.push('warranty_type = ?'); values.push(warranty_type); }
    if (linked_po_id !== undefined) { updates.push('linked_po_id = ?'); values.push(linked_po_id || null); }
    if (linked_invoice_id !== undefined) { updates.push('linked_invoice_id = ?'); values.push(linked_invoice_id || null); }
    if (linked_invoice_type !== undefined) { updates.push('linked_invoice_type = ?'); values.push(linked_invoice_type || null); }
    
    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }
    
    values.push(id);
    
    await req.db.execute(
      `UPDATE warranty_management SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    const [updated] = await req.db.execute(
      'SELECT * FROM warranty_management WHERE id = ?',
      [id]
    );
    
    res.json({ 
      message: 'Warranty record updated successfully',
      record: updated[0]
    });
  } catch (error) {
    console.error('Error updating warranty record:', error);
    res.status(500).json({ message: 'Error updating warranty record', error: error.message });
  }
});

// DELETE /api/warranty/:id - Delete warranty record
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [existing] = await req.db.execute(
      'SELECT id FROM warranty_management WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Warranty record not found' });
    }
    
    await req.db.execute('DELETE FROM warranty_management WHERE id = ?', [id]);
    
    res.json({ message: 'Warranty record deleted successfully' });
  } catch (error) {
    console.error('Error deleting warranty record:', error);
    res.status(500).json({ message: 'Error deleting warranty record', error: error.message });
  }
});

// POST /api/warranty/import - Import warranty data from Excel
router.post('/import', upload.single('file'), async (req, res) => {
  let filePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    filePath = req.file.path;
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    // Use raw: true to get raw values (Excel serial numbers for dates)
    // This gives us full control over date conversion without timezone issues
    const data = xlsx.utils.sheet_to_json(worksheet, { raw: true, defval: null });
    
    if (data.length === 0) {
      return res.status(400).json({ message: 'Excel file is empty' });
    }
    
    const processedItems = [];
    const warrantyType = req.body.warranty_type || 'sales';
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // Map exact column names from the image
        const sr_no = row['Sr. No'] || row['Sr No'] || row['Sr.No'] || row['SR. NO'] || row['SR NO'] || row['SR.NO'] || row.sr_no || '';
        const part_no = row['Part No'] || row['Part No.'] || row['PART NO'] || row['PART NO.'] || row.part_no || '';
        const material_no = row['Material No'] || row['Material No.'] || row['MATERIAL NO'] || row['MATERIAL NO.'] || row.material_no || '';
        const description = row.Description || row.description || row.DESCRIPTION || '';
        // Use helper function to find project_no column with flexible matching (handles "PROJECT NO", "Project No", etc.)
        const project_no = findColumnValue(row, 'Project No') || '';
        const part_cost = row['Part Cost'] || row['Part cost'] || row['PART COST'] || row.part_cost || 0;
        const serial_number = row['Serial Number'] || row['Serial number'] || row['SERIAL NUMBER'] || row.serial_number || '';
        const warranty_start_date = row['Warranty Start Date'] || row['Warranty start date'] || row['WARRANTY START DATE'] || row.warranty_start_date || '';
        const warranty_end_date = row['Warranty End Date'] || row['Warranty end date'] || row['WARRANTY END DATE'] || row.warranty_end_date || '';
        const remarks = row.Remarks || row.remarks || row.REMARKS || '';
        
        // Skip rows with missing essential data
        if (!part_no && !material_no) {
          continue;
        }
        
        // Parse dates
        const formattedStartDate = parseDate(warranty_start_date);
        const formattedEndDate = parseDate(warranty_end_date);
        
        processedItems.push({
          sr_no: sr_no || null,
          part_no: part_no || null,
          material_no: material_no || null,
          description: description || null,
          project_no: project_no || null,
          part_cost: parseFloat(part_cost) || 0,
          serial_number: serial_number || null,
          warranty_start_date: formattedStartDate,
          warranty_end_date: formattedEndDate,
          remarks: remarks || null,
          warranty_type: warrantyType
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
    console.error('Error importing warranty data:', error);
    
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
      message: 'Error importing warranty data',
      error: error.message 
    });
  }
});

module.exports = router;

