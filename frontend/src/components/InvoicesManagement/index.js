import React, { useState, useEffect, useRef } from 'react';
import { salesTaxInvoicesAPI, purchaseTaxInvoicesAPI } from '../../services/api';
import SalesTaxInvoice from '../SalesTaxInvoice';
import PurchaseTaxInvoice from '../PurchaseTaxInvoice';
import './style.scss';

const InvoicesManagement = () => {
  const [activeTab, setActiveTab] = useState('sales'); // 'sales' or 'purchase'
  const [salesInvoices, setSalesInvoices] = useState([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [showAll, setShowAll] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceType, setInvoiceType] = useState(null); // 'sales' or 'purchase'
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const invoiceModalBodyRef = useRef(null);

  useEffect(() => {
    fetchInvoices();
  }, [activeTab, currentPage, showAll, itemsPerPage]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      if (activeTab === 'sales') {
        const params = showAll ? { limit: 1000 } : { page: currentPage, limit: itemsPerPage };
        const response = await salesTaxInvoicesAPI.getAll(params);
        setSalesInvoices(response.data.invoices || []);
        setTotalPages(response.data.pagination?.totalPages || 1);
      } else {
        const params = showAll ? { limit: 1000 } : { page: currentPage, limit: itemsPerPage };
        const response = await purchaseTaxInvoicesAPI.getAll(params);
        setPurchaseInvoices(response.data.invoices || []);
        setTotalPages(response.data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      alert('Error fetching invoices data');
    } finally {
      setLoading(false);
    }
  };

  const handleViewInvoice = (invoice, type) => {
    setSelectedInvoice(invoice);
    setInvoiceType(type);
    setShowInvoiceModal(true);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  };

  const handleCloseInvoiceModal = () => {
    setShowInvoiceModal(false);
    setSelectedInvoice(null);
    setInvoiceType(null);
    // Restore body scroll when modal is closed
    document.body.style.overflow = '';
  };

  const handleDownloadInvoice = async () => {
    if (!selectedInvoice || !selectedInvoice.id) {
      alert('Invoice not found');
      return;
    }

    try {
      setLoading(true);
      
      if (invoiceType === 'purchase') {
        // Use backend PDF API for purchase invoices
        const response = await purchaseTaxInvoicesAPI.generatePDF(selectedInvoice.id);
        
        // Create blob and download
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Purchase_Tax_Invoice_${selectedInvoice.invoice_number || selectedInvoice.id}.pdf`;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }, 0);
      } else {
        // For sales invoices, use client-side PDF generation via print
        // (Backend PDF endpoint not implemented yet)
        if (!invoiceModalBodyRef.current) {
          alert('Invoice content not found');
          return;
        }
        
        const invoiceNode = invoiceModalBodyRef.current.querySelector('.sales-tax-invoice');
        
        if (!invoiceNode) {
          alert('Invoice content not found');
          return;
        }

        // Clone the node to avoid modifying the original
        const clonedNode = invoiceNode.cloneNode(true);
        
        // Get all stylesheets
        const styles = Array.from(
          document.querySelectorAll('link[rel="stylesheet"], style')
        )
          .map((node) => node.outerHTML)
          .join('\n');

        // Create a hidden iframe for PDF generation
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
        if (!iframeDoc) {
          alert('Unable to create PDF');
          return;
        }

        // Write HTML with print styles
        iframeDoc.open();
        iframeDoc.write(`
          <!doctype html>
          <html>
          <head>
            <meta charset="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1"/>
            ${styles}
            <title>Sales Tax Invoice - ${selectedInvoice.invoice_number}</title>
            <style>
              @page {
                size: auto;
                margin: 12mm;
              }
              html, body {
                background: #fff !important;
                margin: 0;
                padding: 0;
              }
              .modal, .modal-backdrop {
                display: none !important;
              }
              .form-actions {
                display: none !important;
              }
              .card {
                border: none !important;
                box-shadow: none !important;
              }
              .card-header {
                display: none !important;
              }
              .alert {
                display: none !important;
              }
              .card-body {
                padding: 1rem !important;
                background-color: white !important;
              }
              .sales-tax-invoice {
                padding: 0 !important;
              }
            </style>
          </head>
          <body>
            ${clonedNode.outerHTML}
          </body>
          </html>
        `);
        iframeDoc.close();

        // Wait for content to load, then trigger print (user can save as PDF)
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error generating PDF. Please use the browser\'s print function.');
          } finally {
            // Cleanup after a delay to allow print dialog to open
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
            }, 1000);
          }
        }, 250);
      }
    } catch (error) {
      console.error('Error downloading invoice:', error);
      alert('Error downloading invoice. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredInvoices = () => {
    const invoices = activeTab === 'sales' ? salesInvoices : purchaseInvoices;
    
    if (!searchTerm.trim()) {
      return invoices;
    }
    
    const searchLower = searchTerm.toLowerCase();
    return invoices.filter((invoice) => {
      const invoiceNumber = invoice.invoice_number || '';
      const customerName = invoice.customer_name || '';
      const supplierName = invoice.supplier_name || '';
      const poNumber = invoice.customer_po_number || invoice.po_number || '';
      
      return (
        invoiceNumber.toLowerCase().includes(searchLower) ||
        customerName.toLowerCase().includes(searchLower) ||
        supplierName.toLowerCase().includes(searchLower) ||
        poNumber.toLowerCase().includes(searchLower)
      );
    });
  };

  const getPaymentStatus = (invoice) => {
    const amountPaid = parseFloat(invoice.amount_paid || 0);
    const grossTotal = parseFloat(invoice.gross_total || 0);
    
    // Payment status is based only on amount_paid vs gross_total
    // VAT is displayed but doesn't affect payment status
    if (amountPaid >= grossTotal && grossTotal > 0) {
      return { status: 'Paid', badgeClass: 'bg-success' };
    } else {
      return { status: 'Unpaid', badgeClass: 'bg-warning' };
    }
  };

  const handleRecordPayment = (invoice) => {
    setSelectedInvoice(invoice);
    setPaymentAmount(invoice.amount_paid || '0');
    setShowPaymentModal(true);
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedInvoice(null);
    setPaymentAmount('');
  };

  const handleSubmitPayment = async () => {
    if (!selectedInvoice) return;
    
    const amount = parseFloat(paymentAmount) || 0;
    if (amount < 0) {
      alert('Payment amount cannot be negative');
      return;
    }

    setPaymentLoading(true);
    try {
      const api = invoiceType === 'sales' ? salesTaxInvoicesAPI : purchaseTaxInvoicesAPI;
      await api.update(selectedInvoice.id, { amount_paid: amount });
      
      alert('Payment recorded successfully!');
      handleClosePaymentModal();
      fetchInvoices(); // Refresh the invoice list
    } catch (error) {
      console.error('Error recording payment:', error);
      alert(error.response?.data?.message || 'Error recording payment');
    } finally {
      setPaymentLoading(false);
    }
  };


  const filteredInvoices = getFilteredInvoices();

  return (
    <div className="invoices-management">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h2>Invoices Management</h2>
            </div>

            {/* Tabs */}
            <ul className="nav nav-tabs mb-4" role="tablist">
              <li className="nav-item" role="presentation">
                <button
                  className={`nav-link ${activeTab === 'sales' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('sales');
                    setCurrentPage(1);
                    setSearchTerm('');
                  }}
                >
                  <i className="fas fa-receipt me-2"></i>
                  Sales Invoices
                  <span className="badge bg-primary ms-2">{salesInvoices.length}</span>
                </button>
              </li>
              <li className="nav-item" role="presentation">
                <button
                  className={`nav-link ${activeTab === 'purchase' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('purchase');
                    setCurrentPage(1);
                    setSearchTerm('');
                  }}
                >
                  <i className="fas fa-file-invoice-dollar me-2"></i>
                  Purchase Invoices
                  <span className="badge bg-success ms-2">{purchaseInvoices.length}</span>
                </button>
              </li>
            </ul>

            {/* Search and Filter */}
            <div className="row mb-3">
              <div className="col-md-6">
                <div className="input-group">
                  <span className="input-group-text">
                    <i className="fas fa-search"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search by invoice number, customer/supplier name, or PO number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="col-md-3">
                <div className="form-check form-switch mt-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="showAll"
                    checked={showAll}
                    onChange={(e) => {
                      setShowAll(e.target.checked);
                      if (e.target.checked) {
                        setCurrentPage(1);
                      }
                    }}
                  />
                  <label className="form-check-label" htmlFor="showAll">
                    Show All
                  </label>
                </div>
              </div>
              {!showAll && (
                <div className="col-md-3">
                  <div className="d-flex align-items-center">
                    <label className="form-label mb-0 me-2">Items per page:</label>
                    <select
                      className="form-select form-select-sm"
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
              )}
            </div>

            {/* Summary */}
            <div className="row mb-2">
              <div className="col-12">
                <span className="text-muted">
                  Showing {filteredInvoices.length} of {activeTab === 'sales' ? salesInvoices.length : purchaseInvoices.length} invoice
                  {filteredInvoices.length !== 1 ? 's' : ''}
                  {!showAll && totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
                </span>
              </div>
            </div>

            {/* Invoices Table */}
            <div className="card">
              <div className="card-body">
                {loading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="table-responsive">
                      <table className="table table-striped table-hover invoices-table">
                        <thead className="table-dark">
                          <tr>
                            <th>Invoice Number</th>
                            <th>Date</th>
                            {activeTab === 'sales' ? (
                              <>
                                <th>Customer</th>
                                <th>Customer PO</th>
                              </>
                            ) : (
                              <>
                                <th>Supplier</th>
                                <th>PO Number</th>
                              </>
                            )}
                            <th>Subtotal</th>
                            <th>VAT</th>
                            <th>Gross Total</th>
                            <th>Payment Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredInvoices.map((invoice) => (
                            <tr key={invoice.id}>
                              <td>
                                <strong>{invoice.invoice_number}</strong>
                              </td>
                              <td>
                                {invoice.invoice_date
                                  ? new Date(invoice.invoice_date).toLocaleDateString()
                                  : 'N/A'}
                              </td>
                              {activeTab === 'sales' ? (
                                <>
                                  <td>{invoice.customer_name || 'N/A'}</td>
                                  <td>{invoice.customer_po_number || '-'}</td>
                                </>
                              ) : (
                                <>
                                  <td>{invoice.supplier_name || 'N/A'}</td>
                                  <td>{invoice.po_number || '-'}</td>
                                </>
                              )}
                              <td>
                                AED {parseFloat(invoice.subtotal || 0).toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                              </td>
                              <td>
                                AED {parseFloat(invoice.vat_amount || 0).toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                              </td>
                              <td>
                                <strong>
                                  AED {parseFloat(invoice.gross_total || 0).toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  })}
                                </strong>
                              </td>
                              <td>
                                {(() => {
                                  const paymentStatus = getPaymentStatus(invoice);
                                  return (
                                    <span className={`badge ${paymentStatus.badgeClass}`}>
                                      {paymentStatus.status}
                                    </span>
                                  );
                                })()}
                                <br />
                                <small className="text-muted">
                                  Paid: AED {parseFloat(invoice.amount_paid || 0).toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  })}
                                </small>
                              </td>
                              <td>
                                <div className="btn-group" role="group">
                                  <button
                                    className="btn btn-sm btn-info"
                                    onClick={() => handleViewInvoice(invoice, activeTab)}
                                    title="View Invoice"
                                  >
                                    <i className="fas fa-eye me-1"></i>
                                    View
                                  </button>
                                  <button
                                    className="btn btn-sm btn-success"
                                    onClick={() => {
                                      setInvoiceType(activeTab);
                                      handleRecordPayment(invoice);
                                    }}
                                    title="Record Payment"
                                  >
                                    <i className="fas fa-money-bill-wave me-1"></i>
                                    Payment
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {filteredInvoices.length === 0 && (
                            <tr>
                              <td colSpan={activeTab === 'sales' ? 9 : 9} className="text-center text-muted py-4">
                                No invoices found
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {!showAll && totalPages > 1 && (
                      <nav aria-label="Invoices pagination">
                        <ul className="pagination justify-content-center">
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
                            <li
                              key={index + 1}
                              className={`page-item ${currentPage === index + 1 ? 'active' : ''}`}
                            >
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
                      </nav>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice View Modal */}
      {showInvoiceModal && selectedInvoice && (
        <>
          <div className="modal show" tabIndex="-1" style={{ display: 'flex' }}>
            <div className="modal-dialog modal-fullscreen">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className={`fas ${invoiceType === 'sales' ? 'fa-receipt' : 'fa-file-invoice-dollar'} me-2`}></i>
                    {invoiceType === 'sales' ? 'Sales Tax Invoice' : 'Purchase Tax Invoice'}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={handleCloseInvoiceModal}
                    aria-label="Close"
                  ></button>
                </div>
                <div className="modal-body" ref={invoiceModalBodyRef}>
                  {invoiceType === 'sales' ? (
                    <SalesTaxInvoice invoiceId={selectedInvoice.id} />
                  ) : (
                    <PurchaseTaxInvoice invoiceId={selectedInvoice.id} />
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleDownloadInvoice}
                  >
                    <i className="fas fa-download me-2"></i>
                    Download
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCloseInvoiceModal}
                  >
                    <i className="fas fa-times me-2"></i>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show"></div>
        </>
      )}

      {/* Payment Recording Modal */}
      {showPaymentModal && selectedInvoice && (
        <>
          <div className="modal show" tabIndex="-1" style={{ display: 'flex' }}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className="fas fa-money-bill-wave me-2"></i>
                    Record Payment
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={handleClosePaymentModal}
                    aria-label="Close"
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Invoice Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={selectedInvoice.invoice_number}
                      disabled
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Gross Total</label>
                    <input
                      type="text"
                      className="form-control"
                      value={`AED ${parseFloat(selectedInvoice.gross_total || 0).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}`}
                      disabled
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Current Amount Paid</label>
                    <input
                      type="text"
                      className="form-control"
                      value={`AED ${parseFloat(selectedInvoice.amount_paid || 0).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}`}
                      disabled
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">
                      Payment Amount <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text">AED</span>
                      <input
                        type="number"
                        className="form-control"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        min="0"
                        step="0.01"
                        placeholder="Enter payment amount"
                        required
                      />
                    </div>
                    <small className="form-text text-muted">
                      Enter the total amount paid for this invoice (including any previous payments)
                    </small>
                  </div>
                  {paymentAmount && (
                    <div className="alert alert-info">
                      <strong>Remaining Balance:</strong> AED {(
                        parseFloat(selectedInvoice.gross_total || 0) - parseFloat(paymentAmount || 0)
                      ).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleClosePaymentModal}
                    disabled={paymentLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={handleSubmitPayment}
                    disabled={paymentLoading || !paymentAmount}
                  >
                    {paymentLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Recording...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save me-2"></i>
                        Record Payment
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show"></div>
        </>
      )}
    </div>
  );
};

export default InvoicesManagement;

