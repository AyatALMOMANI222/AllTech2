const express = require('express');
const multer = require('multer');
const path = require('path');
const archiver = require('archiver');
const {
  uploadFile: uploadToBunny,
  downloadFile: downloadFromBunny,
  deleteFile: deleteFromBunny,
} = require('../services/bunnyStorage');

const router = express.Router();

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];

const MAX_FILE_SIZE = parseInt(process.env.CUSTOMER_SUPPLIER_MAX_FILE_SIZE || `${20 * 1024 * 1024}`, 10); // 20MB default

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number.isFinite(MAX_FILE_SIZE) ? MAX_FILE_SIZE : 20 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Only PDF, JPEG, and PNG files are allowed.'));
  },
});

async function ensureCustomerSupplierExists(pool, id) {
  const [rows] = await pool.execute(
    'SELECT id FROM customers_suppliers WHERE id = ? LIMIT 1',
    [id]
  );
  return rows.length > 0;
}

const normalizeDocumentType = (type) => {
  if (!type) return 'Other';
  const normalized = String(type).trim();
  const allowed = ['Trade License', 'VAT Certificate', 'Other'];
  const match = allowed.find(
    (entry) => entry.toLowerCase() === normalized.toLowerCase()
  );
  return match || 'Other';
};

router.get('/:customerSupplierId', async (req, res) => {
  const { customerSupplierId } = req.params;

  try {
    const exists = await ensureCustomerSupplierExists(req.db, customerSupplierId);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: 'Customer/Supplier record not found.',
      });
    }

    const [documents] = await req.db.execute(
      `SELECT id, customer_supplier_id, file_name, file_type, document_type, storage_path, storage_url, uploaded_at
       FROM customer_supplier_documents
       WHERE customer_supplier_id = ?
       ORDER BY uploaded_at DESC`,
      [customerSupplierId]
    );

    return res.json({
      success: true,
      records: documents,
    });
  } catch (error) {
    console.error('Error fetching customer/supplier documents:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch documents.',
      error: error.message,
    });
  }
});

router.post('/:customerSupplierId', upload.array('documents', 10), async (req, res) => {
  const { customerSupplierId } = req.params;
  const documentType = normalizeDocumentType(req.body?.documentType);

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No documents uploaded.',
    });
  }

  const connection = await req.db.getConnection();
  const uploadedDocuments = [];
  const uploadedRemotePaths = [];

  try {
    const exists = await ensureCustomerSupplierExists(connection, customerSupplierId);
    if (!exists) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Customer/Supplier record not found.',
      });
    }

    await connection.beginTransaction();

    for (const file of req.files) {
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        throw new Error('Only PDF, JPEG, and PNG files are allowed.');
      }

      const directory = `customer-suppliers/${customerSupplierId}`;
      const { remotePath, url } = await uploadToBunny(
        file.buffer,
        file.originalname,
        directory,
        file.mimetype
      );
      uploadedRemotePaths.push(remotePath);

      const [result] = await connection.execute(
        `INSERT INTO customer_supplier_documents
          (customer_supplier_id, file_name, file_type, document_type, storage_path, storage_url)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          customerSupplierId,
          file.originalname,
          file.mimetype,
          documentType,
          remotePath,
          url,
        ]
      );

      uploadedDocuments.push({
        id: result.insertId,
        customer_supplier_id: customerSupplierId,
        file_name: file.originalname,
        file_type: file.mimetype,
        document_type: documentType,
        storage_path: remotePath,
        storage_url: url,
        uploaded_at: new Date(),
      });
    }

    await connection.commit();
    connection.release();

    return res.json({
      success: true,
      message: 'Documents uploaded successfully.',
      records: uploadedDocuments,
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    connection.release();

    // Attempt to clean up any files that were uploaded to Bunny
    for (const remotePath of uploadedRemotePaths) {
      try {
        await deleteFromBunny(remotePath);
      } catch (cleanupError) {
        console.error('Failed to cleanup Bunny file after upload failure:', cleanupError.message);
      }
    }

    console.error('Error uploading customer/supplier documents:', error.message);
    const statusCode = error.message.includes('allowed') ? 400 : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to upload documents.',
    });
  }
});

router.delete('/item/:documentId', async (req, res) => {
  const { documentId } = req.params;

  try {
    const [records] = await req.db.execute(
      `SELECT id, storage_path
       FROM customer_supplier_documents
       WHERE id = ?`,
      [documentId]
    );

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found.',
      });
    }

    const document = records[0];
    await deleteFromBunny(document.storage_path);
    await req.db.execute(
      'DELETE FROM customer_supplier_documents WHERE id = ?',
      [documentId]
    );

    return res.json({
      success: true,
      message: 'Document deleted successfully.',
    });
  } catch (error) {
    console.error('Error deleting customer/supplier document:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete document.',
      error: error.message,
    });
  }
});

router.get('/item/:documentId/download', async (req, res) => {
  const { documentId } = req.params;

  try {
    const [records] = await req.db.execute(
      `SELECT id, file_name, file_type, document_type, storage_path
       FROM customer_supplier_documents
       WHERE id = ?`,
      [documentId]
    );

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found.',
      });
    }

    const document = records[0];
    const file = await downloadFromBunny(document.storage_path);
    const downloadName = document.file_name || path.basename(document.storage_path);

    res.setHeader('Content-Type', file.contentType || document.file_type || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(downloadName)}"`
    );
    if (file.contentLength) {
      res.setHeader('Content-Length', file.contentLength);
    }

    return res.send(file.data);
  } catch (error) {
    console.error('Error downloading customer/supplier document:', error.message);
    const statusCode = error.message.includes('404') ? 404 : 500;
    return res.status(statusCode).json({
      success: false,
      message: 'Failed to download document.',
      error: error.message,
    });
  }
});

router.post('/export', async (req, res) => {
  const { documentIds } = req.body;

  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Please provide an array of document IDs to export.',
    });
  }

  try {
    const placeholders = documentIds.map(() => '?').join(',');
    const [documents] = await req.db.execute(
      `SELECT id, file_name, document_type, storage_path
       FROM customer_supplier_documents
       WHERE id IN (${placeholders})
       ORDER BY uploaded_at ASC`,
      documentIds
    );

    if (documents.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No documents found for the provided IDs.',
      });
    }

    const zipName = `customer-supplier-documents-${Date.now()}.zip`;
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
        const fileName = document.file_name || path.basename(document.storage_path);
        archive.append(file.data, { name: fileName });
      } catch (downloadError) {
        console.error(`Failed to download file for ZIP (ID: ${document.id}):`, downloadError.message);
      }
    }

    await archive.finalize();
  } catch (error) {
    console.error('Error exporting customer/supplier documents:', error.message);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to export documents.',
        error: error.message,
      });
    }
  }
});

module.exports = router;

