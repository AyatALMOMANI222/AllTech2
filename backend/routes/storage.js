const express = require('express');
const multer = require('multer');
const path = require('path');
const {
  uploadFile: uploadToBunny,
  downloadFile: downloadFromBunny,
  deleteFile: deleteFromBunny,
} = require('../services/bunnyStorage');

const router = express.Router();

const MAX_UPLOAD_SIZE = parseInt(process.env.BUNNY_MAX_UPLOAD_SIZE || `${50 * 1024 * 1024}`, 10);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number.isFinite(MAX_UPLOAD_SIZE) ? MAX_UPLOAD_SIZE : 50 * 1024 * 1024,
  },
});

router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file provided.' });
  }

  try {
    const directory = req.body.directory || '';
    const result = await uploadToBunny(
      req.file.buffer,
      req.file.originalname,
      directory,
      req.file.mimetype,
    );

    return res.json({
      success: true,
      message: 'File uploaded successfully.',
      data: {
        fileName: path.basename(result.remotePath),
        remotePath: result.remotePath,
        url: result.url,
      },
    });
  } catch (error) {
    console.error('Bunny upload error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload file to Bunny.net storage.',
      error: error.message,
    });
  }
});

router.get('/files/*', async (req, res) => {
  const remotePath = req.params[0];

  try {
    const file = await downloadFromBunny(remotePath);
    const download = req.query.download === 'true';
    const fileName = path.basename(file.remotePath);

    res.setHeader('Content-Type', file.contentType);
    if (file.contentLength) {
      res.setHeader('Content-Length', file.contentLength);
    }
    if (download) {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    }

    return res.send(file.data);
  } catch (error) {
    console.error('Bunny download error:', error.message);
    const statusCode = error.message.includes('404') ? 404 : 500;
    return res.status(statusCode).json({
      success: false,
      message: 'Failed to fetch file from Bunny.net storage.',
      error: error.message,
    });
  }
});

router.delete('/files/*', async (req, res) => {
  const remotePath = req.params[0];

  try {
    const result = await deleteFromBunny(remotePath);
    return res.json({
      success: true,
      message: 'File deleted successfully.',
      data: result,
    });
  } catch (error) {
    console.error('Bunny delete error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete file from Bunny.net storage.',
      error: error.message,
    });
  }
});

module.exports = router;

