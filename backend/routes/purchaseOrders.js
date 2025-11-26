const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const puppeteer = require('puppeteer');
const {
  uploadFile: uploadToBunny,
  deleteFile: deleteFromBunny,
  downloadFile: downloadFromBunny,
} = require('../services/bunnyStorage');

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

const PO_DOCUMENT_MAX_FILE_SIZE = parseInt(
  process.env.PO_DOCUMENT_MAX_FILE_SIZE || `${25 * 1024 * 1024}`,
  10
);

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: PO_DOCUMENT_MAX_FILE_SIZE,
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'), false);
    }
  },
});

// Helper function to convert Excel date serial number to MySQL DATE format
// Helper function to calculate Due Date: DueDate = PO_Date + LeadTime
// Lead Time can be in two formats:
// 1. Number of days (e.g., 10)
// 2. Number of weeks (e.g., "7 weeks", "7 week", "7w")
// Only for Customer POs (order_type = 'customer')
function calculateDueDate(datePo, leadTime) {
  if (!datePo || !leadTime) {
    return null;
  }
  
  // Parse date_po
  let poDate;
  if (typeof datePo === 'string') {
    poDate = new Date(datePo);
  } else if (datePo instanceof Date) {
    poDate = new Date(datePo);
  } else {
    return null;
  }
  
  if (isNaN(poDate.getTime())) {
    return null;
  }
  
  // Parse lead_time - check if it's in weeks or days
  let leadTimeDays = 0;
  const leadTimeStr = String(leadTime).trim().toLowerCase();
  
  // Check if lead_time contains "week" or "w" (case-insensitive)
  if (leadTimeStr.includes('week') || leadTimeStr.includes('w')) {
    // Extract number from string (e.g., "7 weeks" -> 7, "7w" -> 7)
    const weekMatch = leadTimeStr.match(/(\d+(?:\.\d+)?)/);
    if (weekMatch) {
      const numberOfWeeks = parseFloat(weekMatch[1]);
      if (!isNaN(numberOfWeeks) && numberOfWeeks > 0) {
        // Convert weeks to days: number_of_weeks * 7
        leadTimeDays = numberOfWeeks * 7;
      } else {
        return null;
      }
    } else {
      return null;
    }
  } else {
    // Parse as number of days
    const days = parseFloat(leadTime);
    if (isNaN(days) || days <= 0) {
      return null;
    }
    leadTimeDays = days;
  }
  
  // Add lead_time days to PO date
  poDate.setDate(poDate.getDate() + leadTimeDays);
  
  // Return in YYYY-MM-DD format
  return poDate.toISOString().split('T')[0];
}

// Helper function to format date as YYYY-MM-DD without timezone conversion
function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
  
  // Use local date formatting to avoid timezone shift
  return formatDateLocal(jsDate);
}

// Helper function to generate next PO number in format: PO-YYYY-XXX
async function generatePONumber(db) {
  const currentYear = new Date().getFullYear();
  const prefix = `PO-${currentYear}-`;
  
  try {
    // Get all existing PO numbers for the current year
    const [existingPOs] = await db.execute(
      'SELECT po_number FROM purchase_orders WHERE po_number LIKE ?',
      [`${prefix}%`]
    );
    
    let maxNumber = 0;
    
    if (existingPOs.length > 0) {
      // Extract numbers from all PO numbers and find the maximum
      // This ensures we get the correct maximum even with concurrent requests
      for (const po of existingPOs) {
        const poNumber = po.po_number;
        // Extract the numeric part after the prefix (e.g., "PO-2025-" -> get "001", "002", etc.)
        const numberPart = poNumber.replace(prefix, '');
        const number = parseInt(numberPart) || 0;
        if (number > maxNumber) {
          maxNumber = number;
        }
      }
    }
    
    // Next number is max + 1
    const nextNumber = maxNumber + 1;
    
    // Format as PO-YYYY-XXX where XXX is padded with zeros
    const poNumber = `${prefix}${String(nextNumber).padStart(3, '0')}`;
    
    return poNumber;
  } catch (error) {
    console.error('Error generating PO number:', error);
    // Fallback: try to get max number using simpler query
    try {
      const [existingPOs] = await db.execute(
        'SELECT po_number FROM purchase_orders WHERE po_number LIKE ? ORDER BY po_number DESC LIMIT 100',
        [`${prefix}%`]
      );
      
      let maxNumber = 0;
      if (existingPOs.length > 0) {
        for (const po of existingPOs) {
          const poNumber = po.po_number;
          const numberPart = poNumber.replace(prefix, '');
          const number = parseInt(numberPart) || 0;
          if (number > maxNumber) {
            maxNumber = number;
          }
        }
      }
      
      const nextNumber = maxNumber + 1;
      return `${prefix}${String(nextNumber).padStart(3, '0')}`;
    } catch (fallbackError) {
      console.error('Fallback PO number generation also failed:', fallbackError);
      // Last resort: timestamp-based number
    return `${prefix}${String(Date.now() % 1000).padStart(3, '0')}`;
    }
  }
}

// Function to generate HTML for Purchase Order PDF
function generatePOHtml(order, items) {
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

  const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-AE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  // Calculate totals
  const totalQuantity = items.reduce(
    (sum, item) => sum + (parseFloat(item.quantity) || 0),
    0
  );
  const totalAmount = items.reduce(
    (sum, item) => sum + (parseFloat(item.total_price) || 0),
    0
  );

  // Generate items table rows
  const itemsRows = items
    .map((item) => {
      const unitPriceFormatted = formatCurrency(item.unit_price);
      const totalPriceFormatted = formatCurrency(item.total_price);
      const datePO = formatDate(item.date_po);

      return `
        <tr>
          <td>${item.serial_no || ""}</td>
          <td>${item.project_no || ""}</td>
          <td>${datePO}</td>
          <td>${item.part_no || ""}</td>
          <td>${item.material_no || ""}</td>
          <td>${item.description || ""}</td>
          <td>${item.uom || ""}</td>
          <td>${item.quantity || ""}</td>
          <td>${unitPriceFormatted}</td>
          <td>${totalPriceFormatted}</td>
          <td>${item.lead_time || ""}</td>
          <td>${item.comments || ""}</td>
        </tr>
      `;
    })
    .join("");

  const orderTypeLabel =
    order.order_type === "customer"
      ? "Customer PO (Sales)"
      : "Supplier PO (Purchase)";
  const customerSupplierLabel =
    order.order_type === "customer" ? "Customer Name" : "Supplier Name";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Purchase Order - ${order.po_number}</title>
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
          
          .po-container {
            max-width: 1200px;
            margin: 0 auto;
            background-color: white;
            padding: 2rem;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
          }
          
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #007bff;
            padding-bottom: 20px;
          }
          
          .header h1 {
            margin: 0;
            color: #007bff;
            font-size: 28px;
          }
          
          .header h2 {
            margin: 5px 0 0 0;
            color: #666;
            font-size: 18px;
            font-weight: normal;
          }
          
          .info-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            gap: 20px;
          }
          
          .info-box {
            flex: 1;
            border: 2px solid #007bff;
            padding: 15px;
            border-radius: 8px;
            background-color: #f8f9fa;
          }
          
          .info-row {
            margin-bottom: 10px;
          }
          
          .info-row:last-child {
            margin-bottom: 0;
          }
          
          .info-label {
            font-weight: bold;
            color: #007bff;
            display: inline-block;
            min-width: 120px;
          }
          
          .info-value {
            color: #333;
          }
          
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          
          .items-table thead {
            background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
            color: white;
          }
          
          .items-table th {
            padding: 12px 8px;
            text-align: center;
            font-weight: bold;
            border: 1px solid #0056b3;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .items-table td {
            padding: 10px 8px;
            border: 1px solid #ddd;
            text-align: center;
            font-size: 10px;
          }
          
          .items-table tbody tr:nth-child(even) {
            background-color: #f8f9fa;
          }
          
          .items-table tbody tr:hover {
            background-color: #e3f2fd;
          }
          
          .totals-section {
            display: flex;
            justify-content: flex-end;
            margin-top: 20px;
          }
          
          .totals-box {
            border: 2px solid #28a745;
            padding: 15px;
            border-radius: 8px;
            background-color: #f8f9fa;
            min-width: 300px;
          }
          
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 14px;
          }
          
          .total-row:last-child {
            margin-bottom: 0;
            padding-top: 10px;
            border-top: 2px solid #28a745;
            font-weight: bold;
            font-size: 16px;
            color: #28a745;
          }
          
          .total-label {
            font-weight: 600;
          }
          
          .total-value {
            font-weight: 600;
          }
          
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
          
          @media print {
            body {
              margin: 0;
            }
            .items-table {
              page-break-inside: auto;
            }
            .items-table tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
          }
        </style>
      </head>
      <body>
        <div class="po-container">
          <div class="header">
            <h1>Purchase Order</h1>
            <h2>${order.po_number}</h2>
          </div>

          <div class="info-section">
            <div class="info-box">
              <div class="info-row">
                <span class="info-label">PO Number:</span>
                <span class="info-value">${order.po_number}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Order Type:</span>
                <span class="info-value">${orderTypeLabel}</span>
              </div>
              <div class="info-row">
                <span class="info-label">${customerSupplierLabel}:</span>
                <span class="info-value" style="font-weight: 600; color: #007bff;">${order.customer_supplier_name || "N/A"}</span>
              </div>
            </div>
            <div class="info-box">
              <div class="info-row">
                <span class="info-label">Total Items:</span>
                <span class="info-value">${items.length}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Status:</span>
                <span class="info-value" style="font-weight: 600; text-transform: uppercase;">${order.status || "N/A"}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Generated Date:</span>
                <span class="info-value">${new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Serial No</th>
                <th>Project No</th>
                <th>Date PO</th>
                <th>Part No</th>
                <th>Material No</th>
                <th>Description</th>
                <th>UOM</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total Price</th>
                <th>Lead Time</th>
                <th>Comments</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div class="totals-section">
            <div class="totals-box">
              <div class="total-row">
                <span class="total-label">Total Quantity:</span>
                <span class="total-value">${totalQuantity.toFixed(2)}</span>
              </div>
              <div class="total-row">
                <span class="total-label">Total Amount:</span>
                <span class="total-value">${formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>This is a computer-generated document. No signature is required.</p>
            <p>Generated on ${new Date().toLocaleString()} | AllTech Business Management System</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

const APPROVED_PO_STATUSES = ['approved', 'partially_delivered', 'delivered_completed'];

// Validation middleware
const validatePurchaseOrder = [
  body('po_number')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      // Allow null, undefined, empty string, or valid string
      if (value === null || value === undefined || value === '') {
        return true;
      }
      return typeof value === 'string';
    })
    .withMessage('PO Number must be a string or null'),
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
             u2.username as approved_by_name,
             linked_po.po_number as linked_customer_po_number,
             linked_po.id as linked_customer_po_id,
             supplier_po.po_number as linked_supplier_po_number,
             supplier_po.id as linked_supplier_po_id
      FROM purchase_orders po
      LEFT JOIN customers_suppliers cs ON po.customer_supplier_id = cs.id
      LEFT JOIN users u1 ON po.created_by = u1.id
      LEFT JOIN users u2 ON po.approved_by = u2.id
      LEFT JOIN purchase_orders linked_po ON po.linked_customer_po_id = linked_po.id
      LEFT JOIN purchase_orders supplier_po ON supplier_po.linked_customer_po_id = po.id AND supplier_po.order_type = 'supplier'
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
router.get('/:id/documents', async (req, res) => {
  try {
    const { id } = req.params;

    const [poRows] = await req.db.execute(
      'SELECT po_number FROM purchase_orders WHERE id = ? LIMIT 1',
      [id]
    );

    if (poRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found.',
      });
    }

    const [documents] = await req.db.execute(
      `SELECT id, po_id, document_name, document_type, storage_path, storage_url, uploaded_by, created_at
       FROM po_documents
       WHERE po_id = ?
       ORDER BY created_at DESC`,
      [id]
    );

    return res.json({
      success: true,
      records: documents,
    });
  } catch (error) {
    console.error('Error fetching purchase order documents:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase order documents.',
      error: error.message,
    });
  }
});

router.post('/:id/documents', pdfUpload.array('documents', 10), async (req, res) => {
  const { id } = req.params;

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Please provide at least one PDF document to upload.',
    });
  }

  let connection;
  const uploadedRemotePaths = [];

  try {
    const [poRows] = await req.db.execute(
      'SELECT id, po_number, status FROM purchase_orders WHERE id = ? LIMIT 1',
      [id]
    );

    if (poRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found.',
      });
    }

    const po = poRows[0];

    if (!APPROVED_PO_STATUSES.includes(po.status)) {
      return res.status(400).json({
        success: false,
        message: 'Documents can only be uploaded for approved purchase orders.',
      });
    }

    connection = await req.db.getConnection();
    await connection.beginTransaction();

    const createdBy = req.user?.id || null;
    const directory = `purchase-orders/${po.po_number || po.id}`;
    const insertedRecords = [];

    for (const file of req.files) {
      const { remotePath, url } = await uploadToBunny(
        file.buffer,
        file.originalname,
        directory,
        file.mimetype || 'application/pdf'
      );

      uploadedRemotePaths.push(remotePath);

      const [result] = await connection.execute(
        `INSERT INTO po_documents
          (po_id, document_name, document_type, storage_path, storage_url, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          po.id,
          file.originalname,
          'pdf',
          remotePath,
          url,
          createdBy,
        ]
      );

      insertedRecords.push({
        id: result.insertId,
        po_id: po.id,
        document_name: file.originalname,
        document_type: 'pdf',
        storage_path: remotePath,
        storage_url: url,
        uploaded_by: createdBy,
        created_at: new Date(),
      });
    }

    await connection.commit();

    return res.json({
      success: true,
      message: 'Documents uploaded successfully.',
      records: insertedRecords,
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }

    for (const remotePath of uploadedRemotePaths) {
      try {
        await deleteFromBunny(remotePath);
      } catch (cleanupError) {
        console.error('Failed to cleanup Bunny file after PO upload failure:', cleanupError.message);
      }
    }

    console.error('Error uploading purchase order documents:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload purchase order documents.',
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
});

router.post('/:id/documents/export', async (req, res) => {
  try {
    const { id } = req.params;

    const [poRows] = await req.db.execute(
      'SELECT po_number FROM purchase_orders WHERE id = ? LIMIT 1',
      [id]
    );

    if (poRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found.',
      });
    }

    const poNumber = poRows[0].po_number || `purchase-order-${id}`;

    const [documents] = await req.db.execute(
      `SELECT id, document_name, storage_path
       FROM po_documents
       WHERE po_id = ?
       ORDER BY created_at ASC`,
      [id]
    );

    if (documents.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No documents available for this purchase order.',
      });
    }

    const zipName = `${poNumber.replace(/[^A-Za-z0-9-_]+/g, '_')}-documents.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(res);

    for (const document of documents) {
      try {
        const file = await downloadFromBunny(document.storage_path);
        const safeName = document.document_name || `purchase-order-document-${document.id}.pdf`;
        archive.append(file.data, { name: safeName });
      } catch (error) {
        console.error(`Failed to add document ${document.id} to archive:`, error.message);
      }
    }

    await archive.finalize();
  } catch (error) {
    console.error('Error exporting purchase order documents:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to export purchase order documents.',
        error: error.message,
      });
    }
  }
});

router.get('/documents/:documentId/download', async (req, res) => {
  const { documentId } = req.params;

  try {
    const [documents] = await req.db.execute(
      `SELECT document_name, storage_path
       FROM po_documents
       WHERE id = ? LIMIT 1`,
      [documentId]
    );

    if (documents.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found.',
      });
    }

    const document = documents[0];
    const file = await downloadFromBunny(document.storage_path);
    const fileName = document.document_name || `purchase-order-document-${documentId}.pdf`;

    res.setHeader('Content-Type', file.contentType || 'application/pdf');
    if (file.contentLength) {
      res.setHeader('Content-Length', file.contentLength);
    }
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fileName)}"`
    );

    return res.send(file.data);
  } catch (error) {
    console.error('Error downloading purchase order document:', error);
    const statusCode = error.message?.includes('404') ? 404 : 500;
    return res.status(statusCode).json({
      success: false,
      message: 'Failed to download document.',
      error: error.message,
    });
  }
});

router.delete('/documents/:documentId', async (req, res) => {
  const { documentId } = req.params;

  try {
    const [documents] = await req.db.execute(
      `SELECT storage_path
       FROM po_documents
       WHERE id = ? LIMIT 1`,
      [documentId]
    );

    if (documents.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found.',
      });
    }

    const document = documents[0];

    try {
      await deleteFromBunny(document.storage_path);
    } catch (error) {
      console.error('Failed to delete Bunny file for PO document:', error.message);
    }

    await req.db.execute('DELETE FROM po_documents WHERE id = ?', [documentId]);

    return res.json({
      success: true,
      message: 'Document deleted successfully.',
    });
  } catch (error) {
    console.error('Error deleting purchase order document:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete document.',
      error: error.message,
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get purchase order details
    const [orders] = await req.db.execute(`
      SELECT po.*, 
             cs.company_name as customer_supplier_name,
             u1.username as created_by_name,
             u2.username as approved_by_name,
             linked_po.po_number as linked_customer_po_number,
             linked_po.id as linked_customer_po_id,
             supplier_po.po_number as linked_supplier_po_number,
             supplier_po.id as linked_supplier_po_id
      FROM purchase_orders po
      LEFT JOIN customers_suppliers cs ON po.customer_supplier_id = cs.id
      LEFT JOIN users u1 ON po.created_by = u1.id
      LEFT JOIN users u2 ON po.approved_by = u2.id
      LEFT JOIN purchase_orders linked_po ON po.linked_customer_po_id = linked_po.id
      LEFT JOIN purchase_orders supplier_po ON supplier_po.linked_customer_po_id = po.id AND supplier_po.order_type = 'supplier'
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

// GET /api/purchase-orders/:id/pdf - Generate PDF for purchase order
router.get('/:id/pdf', async (req, res) => {
  let browser;
  try {
    const { id } = req.params;
    
    // Get purchase order details
    const [orders] = await req.db.execute(`
      SELECT po.*, 
             cs.company_name as customer_supplier_name,
             cs.address as customer_supplier_address,
             cs.contact_person as customer_supplier_contact,
             cs.email as customer_supplier_email,
             cs.phone as customer_supplier_phone,
             cs.trn_number as customer_supplier_trn,
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
    
    const order = orders[0];
    
    // Generate HTML for PDF
    const html = generatePOHtml(order, items);
    
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
    res.setHeader('Content-Disposition', `attachment; filename="Purchase_Order_${order.po_number}.pdf"`);
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
      delivered_quantity, delivered_unit_price, delivered_total_price,
      linked_customer_po_id
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
    
    // Validate linked_customer_po_id if provided (must be a valid customer PO)
    let actualLinkedCustomerPOId = null;
    if (linked_customer_po_id) {
      if (order_type !== 'supplier') {
        return res.status(400).json({ 
          message: 'linked_customer_po_id can only be set for supplier orders' 
        });
      }
      
      // Verify the linked PO exists and is a customer PO
      const [linkedPO] = await req.db.execute(
        'SELECT id, order_type FROM purchase_orders WHERE id = ?',
        [linked_customer_po_id]
      );
      
      if (linkedPO.length === 0) {
        return res.status(400).json({ 
          message: 'Linked customer PO not found' 
        });
      }
      
      if (linkedPO[0].order_type !== 'customer') {
        return res.status(400).json({ 
          message: 'Linked PO must be a customer order' 
        });
      }
      
      actualLinkedCustomerPOId = linked_customer_po_id;
    }
    
    // Create purchase order
    const createdBy = req.user?.id || null; // Use null if no user ID available
    const [result] = await req.db.execute(`
      INSERT INTO purchase_orders (po_number, order_type, customer_supplier_id, customer_supplier_name, linked_customer_po_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [finalPONumber, order_type, actualCustomerSupplierId, customerSupplierName, actualLinkedCustomerPOId, createdBy]);
    
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
        
        // For Customer and Supplier POs: Calculate due_date automatically if not provided
        // DueDate = PO_Date + LeadTime (can be in days or weeks)
        // Lead Time can be: number of days (e.g., 10) or number of weeks (e.g., "7 weeks")
        let finalDueDate = due_date || null;
        if ((order_type === 'customer' || order_type === 'supplier') && date_po && lead_time && !finalDueDate) {
          finalDueDate = calculateDueDate(date_po, lead_time);
        }
        
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
          finalDueDate, // Use calculated due_date for Customer POs
          penalty_percentage ? parseFloat(penalty_percentage) : null,
          // Penalty Amount: Always NULL (removed calculations)
          null,
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
    
    // Validate status (only 'approved', 'partially_delivered', and 'delivered_completed' are allowed)
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
    // Update penalty_percentage (penalty_amount always NULL)
    if (penalty_percentage !== undefined && penalty_percentage !== null && penalty_percentage !== '') {
      console.log('Updating penalty_percentage for all items:', penalty_percentage);
      
      try {
        // Update penalty_percentage (penalty_amount always NULL)
        await req.db.execute(`
          UPDATE purchase_order_items SET
            penalty_percentage = ?,
            penalty_amount = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE po_id = ?
        `, [
          parseFloat(penalty_percentage),
          id
        ]);
        
        console.log('✅ Updated penalty_percentage (penalty_amount set to NULL)');
        
        // Recalculate all delivered values (to ensure consistency)
        // This ensures delivered_quantity, delivered_unit_price, delivered_total_price are up to date
        const { calculateAndUpdateDeliveredData } = require('./databaseDashboard');
        await calculateAndUpdateDeliveredData(req.db, id);
        
      } catch (updateError) {
        console.error('Error updating penalty_percentage:', updateError);
        // Don't fail the whole request, just log the error
      }
    }
    
    // Handle form-level fields for delivered status
    if ((status === 'partially_delivered' || status === 'delivered_completed') && (due_date || delivered_quantity || delivered_unit_price || delivered_total_price)) {
      console.log('Updating existing items with form-level fields for delivered status');
      console.log('Form-level fields:', { penalty_percentage, due_date, delivered_quantity, delivered_unit_price, delivered_total_price });
      
      try {
        // Update existing items with form-level values for delivered status
        // Update delivered fields (penalty_amount always NULL)
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
            penalty_amount = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE po_id = ?
        `, [
          delivered_quantity ? parseFloat(delivered_quantity) : null,
          delivered_quantity ? parseFloat(delivered_quantity) : null,
          due_date || null,
          delivered_quantity ? parseFloat(delivered_quantity) : null,
          delivered_unit_price ? parseFloat(delivered_unit_price) : null,
          delivered_total_price ? parseFloat(delivered_total_price) : null,
          delivered_total_price ? parseFloat(delivered_total_price) : null,
          delivered_total_price ? parseFloat(delivered_total_price) : null,
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
          const finalBalanceQuantityUndelivered = item_balance_quantity_undelivered || balance_quantity_undelivered || null;
          const finalDeliveredQuantity = delivered_quantity || null;
          const finalDeliveredUnitPrice = delivered_unit_price || null;
          const finalDeliveredTotalPrice = delivered_total_price || null;
          
          // Penalty Amount: Always NULL (removed calculations)
          let finalPenaltyAmount = null;
          
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
        
        // ⚠️ IMPORTANT: Recalculate all delivered values after PO item updates
        // This ensures delivered_quantity, delivered_unit_price, delivered_total_price,
        // penalty_amount, and balance_quantity_undelivered are always current
        const { calculateAndUpdateDeliveredData } = require('./databaseDashboard');
        await calculateAndUpdateDeliveredData(req.db, id);
        
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
// ⚠️ CASCADE DELETE: Automatically deletes all related invoices (Sales and Purchase Tax Invoices)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the PO number before deleting (needed to find related invoices)
    const [poRows] = await req.db.execute(
      'SELECT po_number FROM purchase_orders WHERE id = ?',
      [id]
    );
    
    if (poRows.length === 0) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }
    
    const poNumber = poRows[0].po_number;
    
    // CASCADE DELETE: Delete all related invoices automatically
    
    // 1. Delete Purchase Tax Invoices related to this PO
    // Get all purchase tax invoices that reference this PO number
    const [purchaseInvoices] = await req.db.execute(
      'SELECT id FROM purchase_tax_invoices WHERE po_number = ?',
      [poNumber]
    );
    
    // Delete purchase tax invoice items first (child records)
    for (const invoice of purchaseInvoices) {
      await req.db.execute(
        'DELETE FROM purchase_tax_invoice_items WHERE invoice_id = ?',
        [invoice.id]
      );
    }
    
    // Delete purchase tax invoices
    if (purchaseInvoices.length > 0) {
      await req.db.execute(
        'DELETE FROM purchase_tax_invoices WHERE po_number = ?',
        [poNumber]
      );
      console.log(`✓ Deleted ${purchaseInvoices.length} purchase tax invoice(s) related to PO ${poNumber}`);
    }
    
    // 2. Delete Sales Tax Invoices related to this PO
    // Get all sales tax invoices that reference this PO number as customer_po_number
    const [salesInvoices] = await req.db.execute(
      'SELECT id FROM sales_tax_invoices WHERE customer_po_number = ?',
      [poNumber]
    );
    
    // Delete sales tax invoice items first (child records)
    for (const invoice of salesInvoices) {
      await req.db.execute(
        'DELETE FROM sales_tax_invoice_items WHERE invoice_id = ?',
        [invoice.id]
      );
    }
    
    // Delete sales tax invoices
    if (salesInvoices.length > 0) {
      await req.db.execute(
        'DELETE FROM sales_tax_invoices WHERE customer_po_number = ?',
        [poNumber]
      );
      console.log(`✓ Deleted ${salesInvoices.length} sales tax invoice(s) related to PO ${poNumber}`);
    }
    
    // 3. Delete purchase order items (child records)
    await req.db.execute('DELETE FROM purchase_order_items WHERE po_id = ?', [id]);
    
    // 4. Finally, delete the purchase order itself
    const [result] = await req.db.execute('DELETE FROM purchase_orders WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }
    
    res.json({ 
      message: 'Purchase order deleted successfully',
      deletedInvoices: {
        purchaseTaxInvoices: purchaseInvoices.length,
        salesTaxInvoices: salesInvoices.length
      }
    });
  } catch (error) {
    console.error('Error deleting purchase order:', error);
    res.status(500).json({ message: 'Error deleting purchase order', error: error.message });
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

      // Validate that required columns exist (case-insensitive) before importing
      // Required columns (from user requirement):
      // serial_no, project_no, date_po, part_no, material_no, description,
      // uom, quantity, unit_price, lead_time, comments
      const headerRows = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) || [];
      const headerRow = headerRows[0] || [];

      // Normalize header names: trim, toLowerCase, replace spaces with underscores
      const normalizeHeader = (h) =>
        h
          .toString()
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '_');

      const normalizedHeaders = new Set(
        headerRow
          .filter((h) => h !== null && h !== undefined && String(h).trim() !== '')
          .map((h) => normalizeHeader(h))
      );

      const requiredColumns = [
        'serial_no',
        'project_no',
        'date_po',
        'part_no',
        'material_no',
        'description',
        'uom',
        'quantity',
        'unit_price',
        'lead_time',
        'comments',
      ];

      const missingColumns = requiredColumns.filter(
        (col) => !normalizedHeaders.has(col)
      );

      if (missingColumns.length > 0) {
        // Clean up uploaded file before returning error
        try {
          if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('File cleaned up due to missing columns:', filePath);
          }
        } catch (cleanupError) {
          console.error('Error cleaning up file after missing columns:', cleanupError);
        }

        return res.status(400).json({
          message:
            'Missing required columns in Excel file. Please ensure all required columns are present (case-insensitive).',
          missing_columns: missingColumns,
          required_columns: requiredColumns,
        });
      }

      // If validation passes, convert sheet rows to JSON objects (existing logic)
      data = xlsx.utils.sheet_to_json(worksheet);
    }
    
    const processedItems = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        // Map exact column names from the image: po_number, project_no, date_po, part_no, material_no, description, uom, quantity, unit_price, lead_time, due_date, comments
        // Also handle variations for backward compatibility
        const po_number = row.po_number || row['po_number'] || row['PO Number'] || row['PO NUMBER'] || row['po_number'] || '';
        const project_no = row.project_no || row['project_no'] || row['Project No'] || row['Project No.'] || row['PROJECT NO'] || row['PROJECT NO.'] || '';
        const date_po = row.date_po || row['date_po'] || row['Date PO'] || row['Date P.O'] || row['Date P.O.'] || row['date p.o'] || row['DATE PO'] || row['DATE P.O'] || row['DATE P.O.'] || '';
        const part_no = row.part_no || row['part_no'] || row['Part No'] || row['Part No.'] || row['PART NO'] || row['PART NO.'] || '';
        const material_no = row.material_no || row['material_no'] || row['Material No'] || row['Material No.'] || row['MATERIAL NO'] || row['MATERIAL NO.'] || '';
        const description = row.description || row['description'] || row.Description || row.DESCRIPTION || '';
        const uom = row.uom || row['uom'] || row.UOM || row['Unit of Measure'] || row['UNIT OF MEASURE'] || '';
        const quantity = row.quantity || row['quantity'] || row.Quantity || row.QUANTITY || 0;
        const unit_price = row.unit_price || row['unit_price'] || row['Unit Price'] || row['Unit price'] || row['UNIT PRICE'] || row.supplier_unit_price || row.customer_unit_price || 0;
        const lead_time = row.lead_time || row['lead_time'] || row['Lead Time'] || row['Lead time'] || row['LEAD TIME'] || row['lead time'] || '';
        // Ignore due_date from Excel - it will be calculated automatically
        const comments = row.comments || row['comments'] || row.Comments || row.COMMENTS || '';
        
        // Calculate total_price (not in image, but needed)
        const total_price = row.total_price || row['total_price'] || row['Total Price'] || row['Total price'] || row['TOTAL PRICE'] || 0;
        
        // Optional fields (for backward compatibility)
        const serial_no = row.serial_no || row['Serial No'] || row['Serial No.'] || row['SERIAL NO'] || row['SERIAL NO.'] || po_number || '';
        const penalty_percentage = row['Penalty %'] || row['Penalty %'] || row.penalty_percentage || row['penalty %'] || row['PENALTY %'] || '';
        const penalty_amount = row['Penalty Amount'] || row['Penalty amount'] || row.penalty_amount || row['penalty amount'] || row['PENALTY AMOUNT'] || '';
        const invoice_no = row['Invoice No'] || row['Invoice No.'] || row.invoice_no || row['invoice no'] || row['INVOICE NO'] || '';
        const balance_quantity_undelivered = row['Balance Quantity Undelivered'] || row['Balance quantity undelivered'] || row.balance_quantity_undelivered || row['balance quantity undelivered'] || row['BALANCE QUANTITY UNDELIVERED'] || '';
        
        // Validate required fields
        if (!part_no || !material_no) {
          console.warn(`Row ${i + 1}: Skipping row - missing Part No or Material No`);
          continue;
        }
        
        // Convert Excel date if needed
        let formattedDatePo = null;
        if (date_po) {
          // Handle Date objects (xlsx might return dates as Date objects)
          if (date_po instanceof Date) {
            formattedDatePo = formatDateLocal(date_po);
          } else if (!isNaN(date_po) && date_po > 0) {
            // Handle Excel serial numbers
            formattedDatePo = convertExcelDate(date_po);
          } else if (typeof date_po === 'string') {
            // Try parsing various date formats (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, etc.)
            const dateStr = date_po.trim();
            // Handle DD/MM/YYYY format (common in Excel)
            if (dateStr.includes('/')) {
              const parts = dateStr.split('/');
              if (parts.length === 3) {
                // Try DD/MM/YYYY first
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
                const year = parseInt(parts[2], 10);
                const parsedDate = new Date(year, month, day);
                if (!isNaN(parsedDate.getTime())) {
                  formattedDatePo = formatDateLocal(parsedDate);
                } else {
                  // Try MM/DD/YYYY
                  const month2 = parseInt(parts[0], 10) - 1; // Month is 0-indexed
                  const day2 = parseInt(parts[1], 10);
                  const year2 = parseInt(parts[2], 10);
                  const parsedDate2 = new Date(year2, month2, day2);
                  if (!isNaN(parsedDate2.getTime())) {
                    formattedDatePo = formatDateLocal(parsedDate2);
                  }
                }
              }
            } else {
              // Try parsing as ISO format or other standard formats
              const parsedDate = new Date(date_po);
              if (!isNaN(parsedDate.getTime())) {
                // Use local date formatting to avoid timezone shift
                formattedDatePo = formatDateLocal(parsedDate);
              }
            }
          }
        }
        
        // Calculate due_date automatically: DueDate = PO_Date + LeadTime
        // Lead Time can be in days or weeks (e.g., "10" or "7 weeks")
        // Only calculate if date_po and lead_time are available
        let calculatedDueDate = null;
        if (formattedDatePo && lead_time) {
          calculatedDueDate = calculateDueDate(formattedDatePo, lead_time);
        }

        // Calculate total_price if not provided or if it's 0
        const calculatedTotalPrice = total_price && parseFloat(total_price) > 0 
          ? parseFloat(total_price) 
          : (parseFloat(quantity) || 0) * (parseFloat(unit_price) || 0);

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
          total_price: calculatedTotalPrice,
          lead_time: lead_time || '',
          due_date: calculatedDueDate, // Automatically calculated, not imported from Excel
          penalty_percentage: penalty_percentage ? parseFloat(penalty_percentage) : null,
          penalty_amount: penalty_amount ? parseFloat(penalty_amount) : null,
          invoice_no: invoice_no || null,
          balance_quantity_undelivered: balance_quantity_undelivered ? parseFloat(balance_quantity_undelivered) : null,
          comments: comments || '',
          po_number: po_number || '' // Add po_number from image
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

// POST /api/purchase-orders/:id/create-supplier-po - Create supplier PO from customer PO
const formatDateForSQL = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().split('T')[0];
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }

  return null;
};

router.post('/:id/create-supplier-po', async (req, res) => {
  try {
    const { id } = req.params;
    const { supplier_id, items = [] } = req.body;
    
    // Get the customer PO
    const [customerPOs] = await req.db.execute(
      'SELECT * FROM purchase_orders WHERE id = ? AND order_type = ?',
      [id, 'customer']
    );
    
    if (customerPOs.length === 0) {
      return res.status(404).json({ 
        message: 'Customer purchase order not found' 
      });
    }
    
    const customerPO = customerPOs[0];
    
    // Check if supplier PO already exists for this customer PO
    const [existingSupplierPOs] = await req.db.execute(
      'SELECT id, po_number FROM purchase_orders WHERE linked_customer_po_id = ?',
      [id]
    );
    
    if (existingSupplierPOs.length > 0) {
      return res.status(400).json({ 
        message: 'Supplier PO already exists for this customer PO',
        existing_supplier_po: {
          id: existingSupplierPOs[0].id,
          po_number: existingSupplierPOs[0].po_number
        }
      });
    }
    
    // Validate supplier_id
    if (!supplier_id) {
      return res.status(400).json({ 
        message: 'Supplier ID is required' 
      });
    }
    
    // Get supplier name
    const [suppliers] = await req.db.execute(
      'SELECT company_name FROM customers_suppliers WHERE id = ? AND type = ?',
      [supplier_id, 'supplier']
    );
    
    if (suppliers.length === 0) {
      return res.status(400).json({ 
        message: 'Supplier not found' 
      });
    }
    
    const supplierName = suppliers[0].company_name;
    
    // Use customer PO number for supplier PO (must match)
    const supplierPONumber = customerPO.po_number;
    
    // Create supplier PO
    const createdBy = req.user?.id || null;
    const [result] = await req.db.execute(`
      INSERT INTO purchase_orders (po_number, order_type, customer_supplier_id, customer_supplier_name, linked_customer_po_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [supplierPONumber, 'supplier', supplier_id, supplierName, id, createdBy]);
    
    const supplierPOId = result.insertId;
    
    // Copy items from customer PO if items not provided, otherwise use provided items
    let itemsToAdd = items;
    if (itemsToAdd.length === 0) {
      // Get items from customer PO
      const [customerItems] = await req.db.execute(
        'SELECT * FROM purchase_order_items WHERE po_id = ?',
        [id]
      );
      
      // Copy items to supplier PO
      for (const item of customerItems) {
        await req.db.execute(`
          INSERT INTO purchase_order_items (
            po_id, serial_no, project_no, date_po, part_no, material_no,
            description, uom, quantity, unit_price, total_price, comments,
            lead_time, due_date, penalty_percentage, penalty_amount, invoice_no, balance_quantity_undelivered,
            delivered_quantity, delivered_unit_price, delivered_total_price
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          supplierPOId,
          item.serial_no,
          item.project_no,
          formatDateForSQL(item.date_po),
          item.part_no,
          item.material_no,
          item.description,
          item.uom,
          item.quantity,
          0,
          0,
          item.comments,
          item.lead_time,
          item.due_date,
          item.penalty_percentage,
          item.penalty_amount,
          item.invoice_no,
          item.balance_quantity_undelivered,
          item.delivered_quantity,
          item.delivered_unit_price,
          item.delivered_total_price
        ]);
      }
    } else {
      // Add provided items
      for (const item of itemsToAdd) {
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
        supplierPOId, 
        serial_no || null, 
        project_no || null, 
        formatDateForSQL(date_po), 
        part_no, 
        material_no,
        description || null, 
        uom || null, 
        parseFloat(quantity) || 0, 
        parseFloat(unit_price) || 0, 
        parseFloat(total_price) || (parseFloat(quantity) * parseFloat(unit_price)), 
        comments || null,
        lead_time || null,
        formatDateForSQL(due_date),
        penalty_percentage ? parseFloat(penalty_percentage) : null,
        // Penalty Amount = penalty_percentage × delivered_total_price
        penalty_percentage && delivered_total_price ? (parseFloat(penalty_percentage) * parseFloat(delivered_total_price)) : null,
          invoice_no || null,
          delivered_quantity && quantity ? (parseFloat(quantity) - parseFloat(delivered_quantity)) : null,
          delivered_quantity ? parseFloat(delivered_quantity) : null,
          delivered_unit_price ? parseFloat(delivered_unit_price) : null,
          delivered_total_price ? parseFloat(delivered_total_price) : null
        ]);
      }
    }
    
    res.status(201).json({
      message: 'Supplier purchase order created successfully',
      id: supplierPOId,
      po_number: supplierPONumber,
      linked_customer_po_id: id,
      linked_customer_po_number: customerPO.po_number
    });
  } catch (error) {
    console.error('Error creating supplier PO from customer PO:', error);
    res.status(500).json({ 
      message: 'Error creating supplier purchase order',
      error: error.message 
    });
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


