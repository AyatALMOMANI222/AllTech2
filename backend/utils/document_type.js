function detectDocumentType(mimetype) {
  if (!mimetype) {
    return 'other';
  }

  const normalized = mimetype.toLowerCase();

  if (normalized.includes('pdf')) {
    return 'pdf';
  }

  if (
    normalized.includes('spreadsheet') ||
    normalized.includes('excel') ||
    normalized.includes('sheet')
  ) {
    return 'excel';
  }

  if (normalized.startsWith('image/')) {
    return 'image';
  }

  return 'other';
}

module.exports = {
  detectDocumentType,
};


