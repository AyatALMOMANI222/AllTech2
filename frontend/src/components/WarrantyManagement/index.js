import React, { useState, useEffect } from 'react';
import { warrantyAPI } from '../../services/api';
import './style.scss';

const WarrantyManagement = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [warrantyType, setWarrantyType] = useState('all'); // 'all', 'sales', 'purchase'
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [importFile, setImportFile] = useState(null);
  const [importWarrantyType, setImportWarrantyType] = useState('sales');
  const [importedItems, setImportedItems] = useState([]);
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  const [formData, setFormData] = useState({
    sr_no: '',
    part_no: '',
    material_no: '',
    description: '',
    project_no: '',
    part_cost: 0,
    serial_number: '',
    warranty_start_date: '',
    warranty_end_date: '',
    remarks: '',
    warranty_type: 'sales',
    linked_po_id: null,
    linked_invoice_id: null,
    linked_invoice_type: null
  });

  useEffect(() => {
    fetchRecords();
  }, [currentPage, searchTerm, warrantyType, itemsPerPage]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm
      };
      
      if (warrantyType !== 'all') {
        params.warranty_type = warrantyType;
      }
      
      const response = await warrantyAPI.getAll(params);
      const data = response.data || response;
      setRecords(data.records || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalRecords(data.pagination?.totalRecords || 0);
    } catch (error) {
      console.error('Error fetching warranty records:', error);
      alert('Error fetching warranty records');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        ...formData,
        part_cost: parseFloat(formData.part_cost) || 0,
        warranty_start_date: formData.warranty_start_date || null,
        warranty_end_date: formData.warranty_end_date || null,
        linked_po_id: formData.linked_po_id || null,
        linked_invoice_id: formData.linked_invoice_id || null,
        linked_invoice_type: formData.linked_invoice_type || null
      };

      if (editingRecord) {
        await warrantyAPI.update(editingRecord.id, data);
        alert('Warranty record updated successfully!');
      } else {
        await warrantyAPI.create(data);
        alert('Warranty record created successfully!');
      }

      setShowModal(false);
      setEditingRecord(null);
      resetForm();
      fetchRecords();
    } catch (error) {
      console.error('Error saving warranty record:', error);
      alert('Error saving warranty record: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    setFormData({
      sr_no: record.sr_no || '',
      part_no: record.part_no || '',
      material_no: record.material_no || '',
      description: record.description || '',
      project_no: record.project_no || '',
      part_cost: record.part_cost || 0,
      serial_number: record.serial_number || '',
      warranty_start_date: record.warranty_start_date ? record.warranty_start_date.split('T')[0] : '',
      warranty_end_date: record.warranty_end_date ? record.warranty_end_date.split('T')[0] : '',
      remarks: record.remarks || '',
      warranty_type: record.warranty_type || 'sales',
      linked_po_id: record.linked_po_id || null,
      linked_invoice_id: record.linked_invoice_id || null,
      linked_invoice_type: record.linked_invoice_type || null
    });
    setShowModal(true);
  };

  const handleView = async (id) => {
    try {
      const response = await warrantyAPI.getById(id);
      const data = response.data || response;
      setViewingRecord(data.record);
      setShowViewModal(true);
    } catch (error) {
      console.error('Error fetching warranty record:', error);
      alert('Error fetching warranty record details');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this warranty record?')) {
      return;
    }

    setLoading(true);
    try {
      await warrantyAPI.delete(id);
      alert('Warranty record deleted successfully!');
      fetchRecords();
    } catch (error) {
      console.error('Error deleting warranty record:', error);
      alert('Error deleting warranty record: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!importFile) {
      alert('Please select a file to import');
      return;
    }

    setLoading(true);
    try {
      const response = await warrantyAPI.import(importFile, importWarrantyType);
      const data = response.data || response;
      setImportedItems(data.items || []);
      setShowImportModal(false);
      setShowVerificationModal(true);
      alert(`Import completed! ${data.items?.length || 0} items processed. Please verify the data.`);
    } catch (error) {
      console.error('Error importing file:', error);
      alert('Error importing file: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveImportedData = async () => {
    if (importedItems.length === 0) {
      alert('No items to save');
      return;
    }

    setLoading(true);
    try {
      // Save each item individually
      for (const item of importedItems) {
        await warrantyAPI.create(item);
      }
      
      setShowVerificationModal(false);
      setImportedItems([]);
      fetchRecords();
      alert(`Successfully saved ${importedItems.length} warranty records!`);
    } catch (error) {
      console.error('Error saving imported data:', error);
      alert('Error saving imported data: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      sr_no: '',
      part_no: '',
      material_no: '',
      description: '',
      project_no: '',
      part_cost: 0,
      serial_number: '',
      warranty_start_date: '',
      warranty_end_date: '',
      remarks: '',
      warranty_type: 'sales',
      linked_po_id: null,
      linked_invoice_id: null,
      linked_invoice_type: null
    });
    setEditingRecord(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className="warranty-management">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h2>Warranty Management</h2>
              <div>
                <button 
                  className="btn btn-success me-2" 
                  onClick={() => { resetForm(); setShowModal(true); }}
                >
                  <i className="fas fa-plus"></i> Add Warranty
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowImportModal(true)}
                >
                  <i className="fas fa-file-excel"></i> Import Excel
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="row mb-3">
              <div className="col-12 col-md-6 col-lg-4 mb-3 mb-md-0">
                <div className="card">
                  <div className="card-body">
                    <label className="form-label">Search</label>
                    <div className="search-box">
                      <i className="fas fa-search"></i>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search warranty records..."
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setCurrentPage(1);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-12 col-md-6 col-lg-3 mb-3 mb-md-0">
                <div className="card">
                  <div className="card-body">
                    <label className="form-label">Warranty Type</label>
                    <select
                      className="form-select"
                      value={warrantyType}
                      onChange={(e) => {
                        setWarrantyType(e.target.value);
                        setCurrentPage(1);
                      }}
                    >
                      <option value="all">All</option>
                      <option value="sales">Sales Warranty</option>
                      <option value="purchase">Purchase Warranty</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="col-12 col-md-6 col-lg-3">
                <div className="card">
                  <div className="card-body">
                    <label className="form-label">Items per page</label>
                    <select
                      className="form-select"
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(parseInt(e.target.value));
                        setCurrentPage(1);
                      }}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="card warranty-table-card">
              <div className="card-body p-0">
                {loading ? (
                  <div className="warranty-table-placeholder">
                    <div className="spinner-border" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : records.length === 0 ? (
                  <div className="warranty-table-placeholder text-muted">
                    <i className="fas fa-inbox fa-3x mb-3"></i>
                    <p className="mb-0">No warranty records found</p>
                    <small>Try adjusting filters or importing data.</small>
                  </div>
                ) : (
                  <div className="table-responsive warranty-table-wrapper">
                    <table className="table table-striped table-hover warranty-table">
                      <thead className="table-dark">
                        <tr>
                          <th>Sr. No</th>
                          <th>Part No</th>
                          <th>Material No</th>
                          <th>Description</th>
                          <th>Project No</th>
                          <th>Part Cost</th>
                          <th>Serial Number</th>
                          <th>Type</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => (
                          <tr key={record.id}>
                            <td data-label="Sr. No">{record.sr_no || '-'}</td>
                            <td data-label="Part No">{record.part_no || '-'}</td>
                            <td data-label="Material No">{record.material_no || '-'}</td>
                            <td data-label="Description" className="description-cell">
                              {record.description || '-'}
                            </td>
                            <td data-label="Project No">{record.project_no || '-'}</td>
                            <td data-label="Part Cost">
                              ${parseFloat(record.part_cost || 0).toFixed(2)}
                            </td>
                            <td data-label="Serial Number">{record.serial_number || '-'}</td>
                            <td data-label="Type">
                              <span className={`badge ${record.warranty_type === 'sales' ? 'bg-success' : 'bg-info'}`}>
                                {record.warranty_type === 'sales' ? 'Sales' : 'Purchase'}
                              </span>
                            </td>
                            <td data-label="Actions">
                              <div className="btn-group" role="group">
                                <button
                                  className="btn btn-sm btn-info"
                                  onClick={() => handleView(record.id)}
                                  title="View"
                                >
                                  <i className="fas fa-eye me-1"></i> View
                                </button>
                                <button
                                  className="btn btn-sm btn-warning"
                                  onClick={() => handleEdit(record)}
                                  title="Edit"
                                >
                                  <i className="fas fa-edit me-1"></i> Edit
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleDelete(record.id)}
                                  title="Delete"
                                >
                                  <i className="fas fa-trash me-1"></i> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav aria-label="Warranty records pagination">
                <ul className="pagination justify-content-center mt-4">
                  <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                    <button
                      className="page-link"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </button>
                  </li>
                  {[...Array(totalPages)].map((_, index) => (
                    <li key={index} className={`page-item ${currentPage === index + 1 ? 'active' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => setCurrentPage(index + 1)}
                      >
                        {index + 1}
                      </button>
                    </li>
                  ))}
                  <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                    <button
                      className="page-link"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </li>
                </ul>
                <div className="text-center text-muted mt-2">
                  <small>Page {currentPage} of {totalPages} (Total: {totalRecords} records)</small>
                </div>
              </nav>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editingRecord ? 'Edit Warranty Record' : 'Add Warranty Record'}</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => { setShowModal(false); resetForm(); }}
                  disabled={loading}
                ></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="row mb-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label">Sr. No</label>
                      <input
                        type="text"
                        className="form-control"
                        name="sr_no"
                        value={formData.sr_no}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Part No <span className="text-danger">*</span></label>
                      <input
                        type="text"
                        className="form-control"
                        name="part_no"
                        value={formData.part_no}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>
                  <div className="row mb-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label">Material No</label>
                      <input
                        type="text"
                        className="form-control"
                        name="material_no"
                        value={formData.material_no}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Project No</label>
                      <input
                        type="text"
                        className="form-control"
                        name="project_no"
                        value={formData.project_no}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows="3"
                    />
                  </div>
                  <div className="row mb-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label">Part Cost</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        name="part_cost"
                        value={formData.part_cost}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Serial Number</label>
                      <input
                        type="text"
                        className="form-control"
                        name="serial_number"
                        value={formData.serial_number}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div className="row mb-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label">Warranty Start Date</label>
                      <input
                        type="date"
                        className="form-control"
                        name="warranty_start_date"
                        value={formData.warranty_start_date}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Warranty End Date</label>
                      <input
                        type="date"
                        className="form-control"
                        name="warranty_end_date"
                        value={formData.warranty_end_date}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Warranty Type <span className="text-danger">*</span></label>
                    <select
                      className="form-select"
                      name="warranty_type"
                      value={formData.warranty_type}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="sales">Sales Warranty</option>
                      <option value="purchase">Purchase Warranty</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Remarks</label>
                    <textarea
                      className="form-control"
                      name="remarks"
                      value={formData.remarks}
                      onChange={handleInputChange}
                      rows="3"
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); resetForm(); }} disabled={loading}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Saving...
                      </>
                    ) : (
                      editingRecord ? 'Update' : 'Save'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && viewingRecord && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Warranty Record Details</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowViewModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row mb-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label text-muted">Sr. No</label>
                    <p className="form-control-plaintext">{viewingRecord.sr_no || 'N/A'}</p>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label text-muted">Part No</label>
                    <p className="form-control-plaintext">{viewingRecord.part_no || 'N/A'}</p>
                  </div>
                </div>
                <div className="row mb-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label text-muted">Material No</label>
                    <p className="form-control-plaintext">{viewingRecord.material_no || 'N/A'}</p>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label text-muted">Project No</label>
                    <p className="form-control-plaintext">{viewingRecord.project_no || 'N/A'}</p>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label text-muted">Description</label>
                  <p className="form-control-plaintext">{viewingRecord.description || 'N/A'}</p>
                </div>
                <div className="row mb-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label text-muted">Part Cost</label>
                    <p className="form-control-plaintext">${parseFloat(viewingRecord.part_cost || 0).toFixed(2)}</p>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label text-muted">Serial Number</label>
                    <p className="form-control-plaintext">{viewingRecord.serial_number || 'N/A'}</p>
                  </div>
                </div>
                <div className="row mb-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label text-muted">Warranty Start Date</label>
                    <p className="form-control-plaintext">{formatDate(viewingRecord.warranty_start_date)}</p>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label text-muted">Warranty End Date</label>
                    <p className="form-control-plaintext">{formatDate(viewingRecord.warranty_end_date)}</p>
                  </div>
                </div>
                <div className="row mb-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label text-muted">Warranty Type</label>
                    <p className="form-control-plaintext">
                      <span className={`badge ${viewingRecord.warranty_type === 'sales' ? 'bg-success' : 'bg-info'}`}>
                        {viewingRecord.warranty_type === 'sales' ? 'Sales' : 'Purchase'}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label text-muted">Remarks</label>
                  <p className="form-control-plaintext">{viewingRecord.remarks || 'N/A'}</p>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowViewModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Import Warranty Data from Excel</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowImportModal(false)}
                  disabled={loading}
                ></button>
              </div>
              <form onSubmit={handleImport}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Warranty Type</label>
                    <select
                      className="form-select"
                      value={importWarrantyType}
                      onChange={(e) => setImportWarrantyType(e.target.value)}
                      required
                    >
                      <option value="sales">Sales Warranty</option>
                      <option value="purchase">Purchase Warranty</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Excel File</label>
                    <input
                      type="file"
                      className="form-control"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => setImportFile(e.target.files[0])}
                      required
                    />
                    <div className="form-text">
                      <strong>Required columns (exact match):</strong>
                      <ul className="mb-2 mt-2" style={{ fontSize: '0.9rem' }}>
                        <li>Sr. No</li>
                        <li>Part No</li>
                        <li>Material No</li>
                        <li>Description</li>
                        <li>Project No</li>
                        <li>Part Cost</li>
                        <li>Serial Number</li>
                        <li>Warranty Start Date</li>
                        <li>Warranty End Date</li>
                        <li>Remarks</li>
                      </ul>
                      <small className="text-muted">
                        <i className="fas fa-info-circle me-1"></i>
                        The Excel file should have these exact column names in the first row.
                      </small>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowImportModal(false)} disabled={loading}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading || !importFile}>
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Importing...
                      </>
                    ) : (
                      'Import'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Verification Modal */}
      {showVerificationModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Verify Imported Data</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => { setShowVerificationModal(false); setImportedItems([]); }}
                  disabled={loading}
                ></button>
              </div>
              <div className="modal-body">
                <p className="mb-3">Please review the imported data before saving:</p>
                <div className="table-responsive">
                  <table className="table table-striped table-hover">
                    <thead className="table-dark">
                      <tr>
                        <th>Sr. No</th>
                        <th>Part No</th>
                        <th>Material No</th>
                        <th>Description</th>
                        <th>Project No</th>
                        <th>Part Cost</th>
                        <th>Serial Number</th>
                        <th>Warranty Start</th>
                        <th>Warranty End</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importedItems.map((item, index) => (
                        <tr key={index}>
                          <td>{item.sr_no || '-'}</td>
                          <td>{item.part_no || '-'}</td>
                          <td>{item.material_no || '-'}</td>
                          <td>{item.description || '-'}</td>
                          <td>{item.project_no || '-'}</td>
                          <td>${parseFloat(item.part_cost || 0).toFixed(2)}</td>
                          <td>{item.serial_number || '-'}</td>
                          <td>{formatDate(item.warranty_start_date)}</td>
                          <td>{formatDate(item.warranty_end_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setShowVerificationModal(false); setImportedItems([]); }}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveImportedData}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Saving...
                    </>
                  ) : (
                    `Save ${importedItems.length} Records`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Backdrop */}
      {(showModal || showViewModal || showImportModal || showVerificationModal) && (
        <div className="modal-backdrop show"></div>
      )}
    </div>
  );
};

export default WarrantyManagement;

