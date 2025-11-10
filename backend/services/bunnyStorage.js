const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');

const REQUIRED_ENV_VARS = [
  'BUNNY_STORAGE_HOSTNAME',
  'BUNNY_STORAGE_USERNAME',
  'BUNNY_STORAGE_PASSWORD',
  'BUNNY_STORAGE_URL',
];

function getConfig() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing Bunny.net storage configuration. Please set: ${missing.join(', ')}`
    );
  }

  const hostname = process.env.BUNNY_STORAGE_HOSTNAME.replace(/\/+$/, '');
  const storageZone = process.env.BUNNY_STORAGE_USERNAME.replace(/\/+$/, '');
  const baseUrl = `https://${hostname}/${storageZone}`;
  const publicUrl = process.env.BUNNY_STORAGE_URL.replace(/\/+$/, '');

  return {
    baseUrl,
    hostname,
    storageZone,
    accessKey: process.env.BUNNY_STORAGE_PASSWORD,
    publicUrl,
  };
}

function normalizeRemotePath(targetPath) {
  if (!targetPath) {
    throw new Error('A file path is required.');
  }

  const cleaned = targetPath
    .replace(/\\/g, '/')
    .replace(/^\/*/, '')
    .trim();

  const parts = cleaned.split('/').filter((segment) => segment && segment !== '.' && segment !== '..');
  if (parts.length === 0) {
    throw new Error('Invalid file path.');
  }

  return parts.join('/');
}

function sanitizeFileName(fileName) {
  const name = fileName || `file-${Date.now()}`;
  const parsed = path.parse(name);
  const safeBase = parsed.name.replace(/[^\w\-]+/g, '_') || `file_${Date.now()}`;
  const safeExt = parsed.ext.replace(/[^.\w]+/g, '');
  return `${safeBase}${safeExt}`;
}

async function uploadFile(buffer, originalName, directory = '', contentType = 'application/octet-stream') {
  const config = getConfig();
  const safeName = sanitizeFileName(originalName);

  const targetDir = directory
    ? normalizeRemotePath(directory)
    : '';

  const remotePath = targetDir ? `${targetDir}/${safeName}` : safeName;
  const uploadUrl = `${config.baseUrl}/${remotePath}`;

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      AccessKey: config.accessKey,
      'Content-Type': contentType || 'application/octet-stream',
    },
    body: buffer,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Bunny.net upload failed (${response.status}): ${message}`);
  }

  return {
    remotePath,
    url: `${config.publicUrl}/${remotePath}`,
  };
}

async function downloadFile(remotePath) {
  const config = getConfig();
  const normalizedPath = normalizeRemotePath(remotePath);
  const downloadUrl = `${config.baseUrl}/${normalizedPath}`;

  const response = await fetch(downloadUrl, {
    method: 'GET',
    headers: {
      AccessKey: config.accessKey,
    },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Bunny.net download failed (${response.status}): ${message}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return {
    data: buffer,
    contentType: response.headers.get('content-type') || 'application/octet-stream',
    contentLength: response.headers.get('content-length'),
    remotePath: normalizedPath,
    url: `${config.publicUrl}/${normalizedPath}`,
  };
}

async function deleteFile(remotePath) {
  const config = getConfig();
  const normalizedPath = normalizeRemotePath(remotePath);
  const deleteUrl = `${config.baseUrl}/${normalizedPath}`;

  const response = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: {
      AccessKey: config.accessKey,
    },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Bunny.net delete failed (${response.status}): ${message}`);
  }

  return { success: true, remotePath: normalizedPath };
}

module.exports = {
  uploadFile,
  downloadFile,
  deleteFile,
};

