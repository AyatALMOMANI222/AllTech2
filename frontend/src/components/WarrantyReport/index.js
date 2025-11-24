import React, { useState, useEffect } from 'react';
import { warrantyAPI } from '../../services/api';
import formatNumber from '../../utils/formatNumber';
import './style.scss';

const WarrantyReport = () => {
  const [reportDate, setReportDate] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Fetch report on component mount (with current date if no date selected)
    fetchReport();
  }, [reportDate]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (reportDate) {
        params.as_of_date = reportDate;
      }
      
      const response = await warrantyAPI.getReport(params);
      setReportData(response.data);
    } catch (error) {
      console.error('Error fetching warranty report:', error);
      setError('Error loading warranty report');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (e) => {
    setReportDate(e.target.value);
  };

  const handleClearDate = () => {
    setReportDate('');
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '-';
    return `AED ${formatNumber(amount)}`;
  };

  const getDaysRemainingColor = (days) => {
    if (days < 0) return 'text-danger'; // Expired
    if (days <= 30) return 'text-warning'; // Expiring soon (within 30 days)
    return 'text-success'; // Good
  };

  const getWarrantyStatus = (days) => {
    if (days < 0) return 'Expired';
    if (days <= 30) return 'Expiring Soon';
    return 'Active';
  };

  const handleViewDetails = (record) => {
    setSelectedRecord(record);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedRecord(null);
  };

  // Filter records by search term
  const filteredRecords = reportData?.records?.filter(record => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      (record.sr_no && String(record.sr_no).toLowerCase().includes(searchLower)) ||
      (record.part_no && String(record.part_no).toLowerCase().includes(searchLower)) ||
      (record.material_no && String(record.material_no).toLowerCase().includes(searchLower)) ||
      (record.description && record.description.toLowerCase().includes(searchLower)) ||
      (record.project_no && String(record.project_no).toLowerCase().includes(searchLower)) ||
      (record.serial_number && String(record.serial_number).toLowerCase().includes(searchLower))
    );
  }) || [];

  return (
    <div className="warranty-report">
      <div className="card warranty-card">
        <div className="card-header warranty-header">
          <div className="d-flex justify-content-between align-items-start flex-wrap">
            <div className="header-content">
              <h2 className="warranty-title">
                <i className="fas fa-shield-alt"></i>
                Warranty Report
              </h2>
              <p className="warranty-subtitle">
                <i className="fas fa-info-circle me-2"></i>
                Display all items currently under warranty
              </p>
            </div>
            <div className="header-info">
              <div className="badge date-badge">
                <i className="fas fa-calendar-alt me-2"></i>
                {reportData?.as_of_date 
                  ? formatDate(reportData.as_of_date)
                  : formatDate(new Date().toISOString().split('T')[0])}
              </div>
              <div className="time-info">
                <i className="fas fa-clock me-1"></i>
                {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
        <div className="card-body warranty-body">
          {error && (
            <div className="alert alert-danger">
              <i className="fas fa-exclamation-triangle me-2"></i>
              {error}
            </div>
          )}

          {/* Filters Section */}
          <div className="filters-section no-print">
            <div className="row g-4">
              <div className="col-lg-4 col-md-6">
                <label className="form-label">
                  <i className="fas fa-calendar me-2"></i>
                  Report Date (Optional)
                </label>
                <div className="input-group">
                  <span className="input-group-text">
                    <i className="fas fa-calendar-alt"></i>
                  </span>
                  <input
                    type="date"
                    className="form-control"
                    value={reportDate}
                    onChange={handleDateChange}
                    placeholder="Select date or leave empty for current date"
                  />
                  {reportDate && (
                    <button
                      className="btn btn-outline-secondary"
                      type="button"
                      onClick={handleClearDate}
                      title="Clear date filter"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  )}
                </div>
                <small className="form-text text-muted mt-2 d-block">
                  {reportDate 
                    ? `Showing items under warranty as of ${formatDate(reportDate)}`
                    : 'Showing items currently under warranty (today)'}
                </small>
              </div>
              <div className="col-lg-4 col-md-6">
                <label className="form-label">
                  <i className="fas fa-search me-2"></i>
                  Search Records
                </label>
                <div className="input-group">
                  <span className="input-group-text">
                    <i className="fas fa-search"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search by part no, material no, description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button
                      className="btn btn-outline-secondary"
                      type="button"
                      onClick={() => setSearchTerm('')}
                      title="Clear search"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  )}
                </div>
                <small className="form-text text-muted mt-2 d-block">
                  Filter warranty items by keywords
                </small>
              </div>
              <div className="col-lg-4 col-md-12">
                <label className="form-label">
                  <i className="fas fa-cogs me-2"></i>
                  Actions
                </label>
                <div className="d-flex gap-2 flex-wrap">
                  <button
                    className="btn btn-primary flex-fill"
                    onClick={fetchReport}
                    disabled={loading}
                  >
                    <i className="fas fa-sync-alt me-2"></i>
                    {loading ? 'Loading...' : 'Refresh'}
                  </button>
                  <button
                    className="btn btn-secondary flex-fill"
                    onClick={handlePrint}
                  >
                    <i className="fas fa-print me-2"></i>
                    Print
                  </button>
                </div>
                <small className="form-text text-muted mt-2 d-block">
                  Refresh data or print the report
                </small>
              </div>
            </div>
          </div>

          {/* Summary Section */}
          {reportData && (
            <div className="summary-section mb-4 no-print">
              <div className="row g-3">
                <div className="col-md-4">
                  <div className="card bg-light border-0 h-100">
                    <div className="card-body text-center">
                      <i className="fas fa-boxes fa-2x text-primary mb-2"></i>
                      <h5 className="card-title">{reportData.total || 0}</h5>
                      <p className="card-text small text-muted">Total Items Under Warranty</p>
                    </div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="card bg-light border-0 h-100">
                    <div className="card-body text-center">
                      <i className="fas fa-exclamation-triangle fa-2x text-warning mb-2"></i>
                      <h5 className="card-title">
                        {filteredRecords.filter(r => r.days_remaining <= 30 && r.days_remaining >= 0).length}
                      </h5>
                      <p className="card-text small text-muted">Expiring Soon (≤30 days)</p>
                    </div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="card bg-light border-0 h-100">
                    <div className="card-body text-center">
                      <i className="fas fa-times-circle fa-2x text-danger mb-2"></i>
                      <h5 className="card-title">
                        {filteredRecords.filter(r => r.days_remaining < 0).length}
                      </h5>
                      <p className="card-text small text-muted">Expired</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && !reportData && (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <h4 className="mt-3 mb-2">
                <i className="fas fa-shield-alt me-2"></i>
                Loading Warranty Report
              </h4>
              <p className="text-muted">Please wait while we fetch warranty data...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && reportData && filteredRecords.length === 0 && (
            <div className="text-center py-5">
              <div className="mb-4">
                <i className="fas fa-shield-alt fa-4x text-muted"></i>
              </div>
              <h4 className="mb-3">
                <i className="fas fa-info-circle me-2"></i>
                No Items Under Warranty
              </h4>
              <p className="text-muted mb-4">
                {searchTerm
                  ? 'No warranty items found matching your search criteria.'
                  : `No items are currently under warranty as of ${formatDate(reportData.as_of_date)}.`}
              </p>
              {searchTerm && (
                <button
                  className="btn btn-outline-primary"
                  onClick={() => setSearchTerm('')}
                >
                  <i className="fas fa-times me-2"></i>
                  Clear Search
                </button>
              )}
            </div>
          )}

          {/* Report Table */}
          {!loading && reportData && filteredRecords.length > 0 && (
            <div className="report-table-container">
              <div className="warranty-table-wrapper">
                <table className="table table-hover warranty-table">
                  <thead className="table-header">
                    <tr>
                      <th>Part No</th>
                      <th>Material No</th>
                      <th>Warranty Type</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Days Remaining</th>
                      <th>Status</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((record) => (
                      <tr key={record.id} className="warranty-row">
                        <td className="fw-bold text-primary">{record.part_no || '-'}</td>
                        <td className="fw-bold">{record.material_no || '-'}</td>
                        <td>
                          <span className={`badge ${record.warranty_type === 'sales' ? 'bg-success' : 'bg-info'}`}>
                            {record.warranty_type === 'sales' ? 'Sales' : 'Purchase'}
                          </span>
                        </td>
                        <td>{formatDate(record.warranty_start_date)}</td>
                        <td>{formatDate(record.warranty_end_date)}</td>
                        <td className="text-center">
                          <span className={`fw-bold ${getDaysRemainingColor(record.days_remaining)}`}>
                            {record.days_remaining !== null ? record.days_remaining : '-'}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className={`badge ${getDaysRemainingColor(record.days_remaining).replace('text-', 'bg-')}`}>
                            {getWarrantyStatus(record.days_remaining)}
                          </span>
                        </td>
                        <td className="text-center">
                          <button
                            className="btn btn-sm btn-outline-primary view-btn"
                            onClick={() => handleViewDetails(record)}
                            title="View full details"
                          >
                            <i className="fas fa-eye me-1"></i>
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Details Modal */}
          {showModal && selectedRecord && (
            <div className="modal-overlay" onClick={handleCloseModal}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className="fas fa-shield-alt me-2"></i>
                    Warranty Details
                  </h5>
                  <button
                    type="button"
                    className="btn-close-modal"
                    onClick={handleCloseModal}
                    aria-label="Close"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="details-grid">
                    <div className="detail-item">
                      <label>
                        <i className="fas fa-hashtag me-2"></i>
                        Sr. No
                      </label>
                      <div className="detail-value">{selectedRecord.sr_no || '-'}</div>
                    </div>
                    <div className="detail-item">
                      <label>
                        <i className="fas fa-box me-2"></i>
                        Part No
                      </label>
                      <div className="detail-value fw-bold text-primary">{selectedRecord.part_no || '-'}</div>
                    </div>
                    <div className="detail-item">
                      <label>
                        <i className="fas fa-barcode me-2"></i>
                        Material No
                      </label>
                      <div className="detail-value fw-bold">{selectedRecord.material_no || '-'}</div>
                    </div>
                    <div className="detail-item">
                      <label>
                        <i className="fas fa-file-alt me-2"></i>
                        Description
                      </label>
                      <div className="detail-value">{selectedRecord.description || '-'}</div>
                    </div>
                    <div className="detail-item">
                      <label>
                        <i className="fas fa-folder me-2"></i>
                        Project No
                      </label>
                      <div className="detail-value">{selectedRecord.project_no || '-'}</div>
                    </div>
                    <div className="detail-item">
                      <label>
                        <i className="fas fa-microchip me-2"></i>
                        Serial Number
                      </label>
                      <div className="detail-value">{selectedRecord.serial_number || '-'}</div>
                    </div>
                    <div className="detail-item">
                      <label>
                        <i className="fas fa-dollar-sign me-2"></i>
                        Part Cost
                      </label>
                      <div className="detail-value fw-bold">{formatCurrency(selectedRecord.part_cost)}</div>
                    </div>
                    <div className="detail-item">
                      <label>
                        <i className="fas fa-tag me-2"></i>
                        Warranty Type
                      </label>
                      <div className="detail-value">
                        <span className={`badge ${selectedRecord.warranty_type === 'sales' ? 'bg-success' : 'bg-info'}`}>
                          {selectedRecord.warranty_type === 'sales' ? 'Sales' : 'Purchase'}
                        </span>
                      </div>
                    </div>
                    <div className="detail-item">
                      <label>
                        <i className="fas fa-calendar-check me-2"></i>
                        Start Date
                      </label>
                      <div className="detail-value">{formatDate(selectedRecord.warranty_start_date)}</div>
                    </div>
                    <div className="detail-item">
                      <label>
                        <i className="fas fa-calendar-times me-2"></i>
                        End Date
                      </label>
                      <div className="detail-value">{formatDate(selectedRecord.warranty_end_date)}</div>
                    </div>
                    <div className="detail-item">
                      <label>
                        <i className="fas fa-clock me-2"></i>
                        Days Remaining
                      </label>
                      <div className="detail-value">
                        <span className={`fw-bold ${getDaysRemainingColor(selectedRecord.days_remaining)}`}>
                          {selectedRecord.days_remaining !== null ? selectedRecord.days_remaining : '-'} days
                        </span>
                      </div>
                    </div>
                    <div className="detail-item">
                      <label>
                        <i className="fas fa-info-circle me-2"></i>
                        Status
                      </label>
                      <div className="detail-value">
                        <span className={`badge ${getDaysRemainingColor(selectedRecord.days_remaining).replace('text-', 'bg-')}`}>
                          {getWarrantyStatus(selectedRecord.days_remaining)}
                        </span>
                      </div>
                    </div>
                    <div className="detail-item full-width">
                      <label>
                        <i className="fas fa-comment me-2"></i>
                        Remarks
                      </label>
                      <div className="detail-value">{selectedRecord.remarks || '-'}</div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCloseModal}
                  >
                    <i className="fas fa-times me-2"></i>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          {reportData && filteredRecords.length > 0 && (
            <div className="row mt-4 no-print">
              <div className="col-12">
                <div className="card bg-light border-0">
                  <div className="card-body text-center py-3">
                    <p className="mb-0 text-muted">
                      <i className="fas fa-info-circle me-2"></i>
                      Report generated on {new Date().toLocaleString()} | 
                      <span className="ms-2">
                        <i className="fas fa-shield-alt me-1"></i>
                        Warranty Report - {reportData.total} item(s) under warranty
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WarrantyReport;

