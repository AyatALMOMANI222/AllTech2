import React, { useState, useEffect } from 'react';
import { customersSuppliersAPI } from '../../services/api';
import CustomerSupplierForm from '../CustomerSupplierForm';
import './style.scss';

const CustomerSupplierManagement = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [viewingRecord, setViewingRecord] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);

  useEffect(() => {
    fetchRecords();
  }, [searchTerm, filterType]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (filterType) params.type = filterType;
      
      const response = await customersSuppliersAPI.getAll(params);
      setRecords(response.data.records);
    } catch (error) {
      setError('Failed to fetch records');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecord = () => {
    setEditingRecord(null);
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const handleEditRecord = (record) => {
    setEditingRecord(record);
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const handleDeleteRecord = async (recordId) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        await customersSuppliersAPI.delete(recordId);
        setSuccess('Record deleted successfully');
        fetchRecords();
      } catch (error) {
        setError('Failed to delete record');
      }
    }
  };

  const handleFormSubmit = async (recordData) => {
    try {
      if (editingRecord) {
        await customersSuppliersAPI.update(editingRecord.id, recordData);
        setSuccess('Record updated successfully');
      } else {
        await customersSuppliersAPI.create(recordData);
        setSuccess('Record created successfully');
      }
      setShowForm(false);
      setEditingRecord(null);
      fetchRecords();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to save record');
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingRecord(null);
    setError('');
    setSuccess('');
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleFilterChange = (e) => {
    setFilterType(e.target.value);
  };

  const handleViewRecord = (record) => {
    setViewingRecord(record);
    setShowViewModal(true);
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setViewingRecord(null);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-supplier-management-container">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h2>Customer/Supplier Management</h2>
              <button className="btn btn-primary" onClick={handleAddRecord}>
                <i className="fas fa-plus me-2"></i>
                Add Record
              </button>
            </div>

            {/* Search and Filter */}
            <div className="row mb-4">
              <div className="col-md-6">
                <div className="input-group">
                  <span className="input-group-text">
                    <i className="fas fa-search"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search by company name, contact person, or email..."
                    value={searchTerm}
                    onChange={handleSearch}
                  />
                </div>
              </div>
              <div className="col-md-3">
                <select
                  className="form-select"
                  value={filterType}
                  onChange={handleFilterChange}
                >
                  <option value="">All Types</option>
                  <option value="customer">Customers</option>
                  <option value="supplier">Suppliers</option>
                </select>
              </div>
              <div className="col-md-3">
                <button className="btn btn-outline-secondary w-100" onClick={() => {
                  setSearchTerm('');
                  setFilterType('');
                }}>
                  Clear Filters
                </button>
              </div>
            </div>

            {error && (
              <div className="alert alert-danger" role="alert">
                {error}
              </div>
            )}

            {success && (
              <div className="alert alert-success" role="alert">
                {success}
              </div>
            )}

            <div className="card">
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Company Name</th>
                        <th>Contact Person</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>TRN Number</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record) => (
                        <tr key={record.id}>
                          <td>
                            <span className={`badge ${record.type === 'customer' ? 'bg-success' : 'bg-info'}`}>
                              {record.type}
                            </span>
                          </td>
                          <td>{record.company_name}</td>
                          <td>{record.contact_person || '-'}</td>
                          <td>{record.email || '-'}</td>
                          <td>{record.phone || '-'}</td>
                          <td>{record.trn_number || '-'}</td>
                          <td>
                            <div className="btn-group" role="group">
                              <button
                                className="btn btn-sm btn-outline-info"
                                onClick={() => handleViewRecord(record)}
                                title="View Details"
                              >
                                <i className="fas fa-eye"></i>
                                <span>View</span>
                              </button>
                              <button
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => handleEditRecord(record)}
                                title="Edit Record"
                              >
                                <i className="fas fa-edit"></i>
                                <span>Edit</span>
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDeleteRecord(record.id)}
                                title="Delete Record"
                              >
                                <i className="fas fa-trash"></i>
                                <span>Delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {records.length === 0 && (
                        <tr>
                          <td colSpan="7" className="text-center text-muted py-4">
                            No records found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <CustomerSupplierForm
          record={editingRecord}
          onSubmit={handleFormSubmit}
          onClose={handleCloseForm}
        />
      )}

      {/* View Details Modal */}
      {showViewModal && viewingRecord && (
        <div className="modal-overlay" onClick={handleCloseViewModal}>
          <div className="modal-container view-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{viewingRecord.company_name} Details</h3>
              <button className="btn-close" onClick={handleCloseViewModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Type</label>
                  <span className={`badge ${viewingRecord.type === 'customer' ? 'bg-success' : 'bg-info'}`}>
                    {viewingRecord.type}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Company Name</label>
                  <span>{viewingRecord.company_name}</span>
                </div>
                <div className="detail-item">
                  <label>Contact Person</label>
                  <span>{viewingRecord.contact_person || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Email</label>
                  <span>{viewingRecord.email || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Phone</label>
                  <span>{viewingRecord.phone || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>TRN Number</label>
                  <span>{viewingRecord.trn_number || 'N/A'}</span>
                </div>
                <div className="detail-item full-width">
                  <label>Address</label>
                  <span>{viewingRecord.address || 'N/A'}</span>
                </div>
                {viewingRecord.document_attachment && (
                  <div className="detail-item full-width">
                    <label>Document Attachment</label>
                    <span>{viewingRecord.document_attachment}</span>
                  </div>
                )}
                <div className="detail-item">
                  <label>Created At</label>
                  <span>{new Date(viewingRecord.created_at).toLocaleDateString()}</span>
                </div>
                <div className="detail-item">
                  <label>Updated At</label>
                  <span>{new Date(viewingRecord.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={handleCloseViewModal}
                type="button"
              >
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  handleCloseViewModal();
                  handleEditRecord(viewingRecord);
                }}
                type="button"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerSupplierManagement;
