import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { customerSupplierDocumentsAPI } from '../../services/api';
import './style.scss';

const ALLOWED_EXTENSIONS = '.pdf,.jpeg,.jpg,.png';

const CustomerSupplierDocumentsModal = ({ record, onClose }) => {
  const [documents, setDocuments] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedDocumentType, setSelectedDocumentType] = useState('Trade License');
  const buildSafeUrl = useCallback((url) => {
    if (!url) return '#';
    try {
      const parsed = new URL(url);
      const encodedPath = parsed.pathname
        .split('/')
        .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
        .join('/');
      parsed.pathname = encodedPath;
      return parsed.toString();
    } catch (error) {
      return url;
    }
  }, []);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);

  const hasDocuments = useMemo(() => documents.length > 0, [documents]);

  const fetchDocuments = useCallback(async () => {
    if (!record?.id) return;

    try {
      setLoading(true);
      setError('');
      const response = await customerSupplierDocumentsAPI.list(record.id);
      setDocuments(response.data.records || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }, [record?.id]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileChange = (event) => {
    setError('');
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      setSelectedFiles([]);
      return;
    }
    setSelectedFiles(files);
  };

  const resetFileInput = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!record?.id) return;
    if (!selectedFiles.length) {
      setError('Please select at least one document to upload.');
      return;
    }

    try {
      setUploading(true);
      setError('');
      setSuccess('');

      await customerSupplierDocumentsAPI.upload(record.id, selectedFiles, selectedDocumentType);
      setSuccess('Documents uploaded successfully.');
      resetFileInput();
      fetchDocuments();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload documents.');
    } finally {
      setUploading(false);
    }
  };

  const downloadBlob = (blob, fileName) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleDownload = async (document) => {
    try {
      setDownloadingId(document.id);
      const response = await customerSupplierDocumentsAPI.download(document.id);
      const blob = response.data;
      const fileName = document.file_name || `document-${document.id}`;
      downloadBlob(blob, fileName);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to download the document.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (document) => {
    if (!window.confirm(`Delete "${document.file_name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingId(document.id);
      setError('');
      setSuccess('');

      await customerSupplierDocumentsAPI.delete(document.id);
      setSuccess('Document deleted successfully.');
      fetchDocuments();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete document.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const closeModal = (refresh = false) => {
    if (typeof onClose === 'function') {
      onClose(refresh);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => closeModal(false)}>
      <div
        className="modal-container documents-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header documents-modal__header">
          <div>
            <h3>Documents – {record?.company_name}</h3>
            <p className="documents-modal__subtitle">
              Upload and manage documents for this {record?.type || 'record'}.
            </p>
          </div>
          <button className="btn-close" onClick={() => closeModal(false)}>
            ×
          </button>
        </div>

        <div className="modal-body documents-modal__body">
          {(error || success) && (
            <div className={`alert ${error ? 'alert-danger' : 'alert-success'}`}>
              {error || success}
            </div>
          )}

          <div className="documents-upload-card">
            <h4>Upload Documents</h4>
            <p className="documents-upload-card__hint">
              Supported formats: PDF, JPEG, PNG. You can upload multiple files at once.
            </p>
            <div className="documents-upload-card__input">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ALLOWED_EXTENSIONS}
                onChange={handleFileChange}
              />
              {selectedFiles.length > 0 && (
                <div className="selected-files-list">
                  <strong>Selected ({selectedFiles.length}):</strong>
                  <ul>
                    {selectedFiles.map((file) => (
                      <li key={`${file.name}-${file.lastModified}`}>{file.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="documents-type-selector">
              <label htmlFor="documentType" className="form-label">
                Document Type
              </label>
              <select
                id="documentType"
                className="form-select"
                value={selectedDocumentType}
                onChange={(event) => setSelectedDocumentType(event.target.value)}
              >
                <option value="Trade License">Trade License</option>
                <option value="VAT Certificate">VAT Certificate</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="documents-upload-card__actions">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  resetFileInput();
                  setError('');
                  setSuccess('');
                }}
                disabled={uploading}
                type="button"
              >
                Clear Selection
              </button>
              <button
                className="btn btn-primary"
                onClick={handleUpload}
                disabled={uploading || selectedFiles.length === 0}
                type="button"
              >
                {uploading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <i className="fas fa-cloud-upload-alt me-2"></i>
                    Upload Documents
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="documents-table-card">
            <div className="documents-table-card__header">
              <div>
                <h4>
                  Stored Documents{' '}
                  {hasDocuments ? <span>({documents.length})</span> : null}
                </h4>
                <p className="documents-table-card__subtitle">
                  View, download, or remove uploaded documents for this record.
                </p>
              </div>
            </div>

            <div className="documents-collection">
              {loading ? (
                <div className="documents-collection__placeholder">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2 text-muted">Fetching stored documents...</p>
                </div>
              ) : !hasDocuments ? (
                <div className="documents-collection__placeholder">
                  <i className="far fa-folder-open mb-3"></i>
                  <p className="mb-1">No documents uploaded yet.</p>
                  <p className="text-muted mb-0">
                    Use the upload section above to add licenses, certificates, or other documents.
                  </p>
                </div>
              ) : (
                <div className="documents-grid">
                  {documents.map((document) => (
                    <div className="document-card" key={document.id}>
                      <div className="document-card__icon">
                        <i className="far fa-file-alt"></i>
                      </div>
                      <div className="document-card__content">
                        <div className="document-card__title">
                          <h5 title={document.file_name || 'Untitled Document'}>
                            {document.file_name || 'Untitled Document'}
                          </h5>
                          <span className="document-card__type">
                            {document.document_type || 'Other'}
                          </span>
                        </div>
                        <p className="document-card__meta">
                          Uploaded {formatDate(document.uploaded_at)}
                        </p>
                      </div>
                      <div className="document-card__actions">
                        <a
                         href={`https://${buildSafeUrl(document.storage_url)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-outline-info"
                        >
                          <i className="fas fa-external-link-alt"></i>
                          <span>Open</span>
                        </a>
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleDownload(document)}
                          disabled={downloadingId === document.id}
                          type="button"
                        >
                          {downloadingId === document.id ? (
                            <span className="spinner-border spinner-border-sm" />
                          ) : (
                            <i className="fas fa-download"></i>
                          )}
                          <span>Download</span>
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDelete(document)}
                          disabled={deletingId === document.id}
                          type="button"
                        >
                          {deletingId === document.id ? (
                            <span className="spinner-border spinner-border-sm" />
                          ) : (
                            <i className="fas fa-trash-alt"></i>
                          )}
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer documents-modal__footer">
          <button
            className="btn btn-secondary"
            onClick={() => {
              resetFileInput();
              closeModal(false);
            }}
            type="button"
          >
            Close
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              closeModal(true);
            }}
            type="button"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerSupplierDocumentsModal;

