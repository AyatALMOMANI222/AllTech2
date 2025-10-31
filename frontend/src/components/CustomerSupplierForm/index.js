import React, { useState, useEffect } from 'react';
import './style.scss';

const CustomerSupplierForm = ({ record, onSubmit, onClose }) => {
  const [formData, setFormData] = useState({
    type: 'customer',
    companyName: '',
    address: '',
    trnNumber: '',
    contactPerson: '',
    email: '',
    phone: '',
    documentAttachment: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (record) {
      setFormData({
        type: record.type || 'customer',
        companyName: record.company_name || '',
        address: record.address || '',
        trnNumber: record.trn_number || '',
        contactPerson: record.contact_person || '',
        email: record.email || '',
        phone: record.phone || '',
        documentAttachment: record.document_attachment || ''
      });
    }
  }, [record]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.type) {
      newErrors.type = 'Type is required';
    }

    if (!formData.companyName.trim()) {
      newErrors.companyName = 'Company name is required';
    }

    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              {record ? 'Edit Record' : 'Add New Record'}
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              disabled={loading}
            >×</button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label htmlFor="type" className="form-label">
                    Type *
                  </label>
                  <select
                    className={`form-select ${errors.type ? 'is-invalid' : ''}`}
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    disabled={loading}
                  >
                    <option value="customer">Customer</option>
                    <option value="supplier">Supplier</option>
                  </select>
                  {errors.type && (
                    <div className="invalid-feedback">
                      {errors.type}
                    </div>
                  )}
                </div>
                
                <div className="col-md-6 mb-3">
                  <label htmlFor="companyName" className="form-label">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    className={`form-control ${errors.companyName ? 'is-invalid' : ''}`}
                    id="companyName"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    disabled={loading}
                  />
                  {errors.companyName && (
                    <div className="invalid-feedback">
                      {errors.companyName}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="row">
                <div className="col-12 mb-3">
                  <label htmlFor="address" className="form-label">
                    Address
                  </label>
                  <textarea
                    className="form-control"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    disabled={loading}
                    rows="3"
                  />
                </div>
              </div>
              
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label htmlFor="trnNumber" className="form-label">
                    TRN Number
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="trnNumber"
                    name="trnNumber"
                    value={formData.trnNumber}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
                
                <div className="col-md-6 mb-3">
                  <label htmlFor="contactPerson" className="form-label">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="contactPerson"
                    name="contactPerson"
                    value={formData.contactPerson}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
              </div>
              
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label htmlFor="email" className="form-label">
                    Email
                  </label>
                  <input
                    type="email"
                    className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={loading}
                  />
                  {errors.email && (
                    <div className="invalid-feedback">
                      {errors.email}
                    </div>
                  )}
                </div>
                
                <div className="col-md-6 mb-3">
                  <label htmlFor="phone" className="form-label">
                    Phone
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
              </div>
              
              <div className="row">
                <div className="col-12 mb-3">
                  <label htmlFor="documentAttachment" className="form-label">
                    Document Attachment (URL)
                  </label>
                  <input
                    type="url"
                    className="form-control"
                    id="documentAttachment"
                    name="documentAttachment"
                    value={formData.documentAttachment}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="https://example.com/document.pdf"
                  />
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    {record ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  record ? 'Update Record' : 'Create Record'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CustomerSupplierForm;
