import React, { useState, useEffect } from 'react';
import { purchaseTaxInvoicesAPI, customersSuppliersAPI, purchaseOrdersAPI } from '../../services/api';
import formatCurrency from '../../utils/formatCurrency';
import './style.scss';

const PurchaseTaxInvoice = ({ invoiceId = null }) => {
  const [formData, setFormData] = useState({
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    supplier_id: '',
    po_number: '',
    project_number: '',
    claim_percentage: 100,
    items: []
  });

  const [suppliers, setSuppliers] = useState([]);
  const [poNumbers, setPoNumbers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [selectedPO, setSelectedPO] = useState(null);
  const [totalClaimPercentage, setTotalClaimPercentage] = useState(0); // Total claim from previous invoices
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Load invoice details if invoiceId is provided (view mode)
  useEffect(() => {
    const loadInvoice = async () => {
      if (!invoiceId) return;
      try {
        setLoading(true);
        const res = await purchaseTaxInvoicesAPI.getById(invoiceId);
        const inv = res.data.invoice || {};
        const items = res.data.items || [];
        setFormData({
          invoice_number: inv.invoice_number || '',
          invoice_date: inv.invoice_date ? inv.invoice_date.split('T')[0] : '',
          supplier_id: inv.supplier_id || '',
          po_number: inv.po_number || '',
          project_number: inv.project_number || '',
          claim_percentage: inv.claim_percentage || 100,
          items: items.map(item => {
            const quantity = parseFloat(item.quantity) || 0;
            const unitPrice = parseFloat(item.supplier_unit_price) || 0;
            const totalPrice = quantity * unitPrice;
            return {
              serial_no: item.serial_no || 1,
              project_no: item.project_no || '',
              part_no: item.part_no || '',
              material_no: item.material_no || '',
              description: item.description || '',
              uom: item.uom || '',
              quantity: quantity,
              max_quantity: quantity, // For existing invoices, use current quantity as max
              supplier_unit_price: unitPrice,
              total_price: totalPrice
            };
          })
        });
        // Load supplier details for display
        if (inv.supplier_id) {
          try {
            const supplierRes = await customersSuppliersAPI.getById(inv.supplier_id);
            const supplierData = supplierRes.data.record || supplierRes.data;
            setSelectedSupplier(supplierData);
          } catch (_) {}
        }
        
        // Load total claim percentage from previous invoices (excluding current invoice)
        if (inv.po_number) {
          try {
            const params = { exclude_invoice_id: invoiceId };
            const poResponse = await purchaseTaxInvoicesAPI.getPoItems(inv.po_number, params);
            const totalClaim = parseFloat(poResponse.data.total_claim_percentage || 0);
            setTotalClaimPercentage(totalClaim);
          } catch (_) {
            setTotalClaimPercentage(0);
          }
        }
      } catch (err) {
        console.error('Error loading invoice:', err);
        const errorMessage = formatErrorMessages(err);
        setError(errorMessage);
        showToast(errorMessage, 'error');
      } finally {
        setLoading(false);
      }
    };
    loadInvoice();
  }, [invoiceId]);

  const fetchSuppliers = async () => {
    try {
      const response = await purchaseTaxInvoicesAPI.getSuppliers();
      setSuppliers(response.data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      setSuppliers([]);
    }
  };

  const fetchPoNumbers = async (supplierId) => {
    try {
      const response = await purchaseTaxInvoicesAPI.getPoNumbers(supplierId);
      setPoNumbers(response.data || []);
    } catch (error) {
      console.error('Error fetching PO numbers:', error);
      setPoNumbers([]);
    }
  };

  // Calculate remaining amount percentage
  const calculateRemainingAmount = (claimPercentage, previousClaims) => {
    const claim = parseFloat(claimPercentage) || 0;
    const previous = parseFloat(previousClaims) || 0;
    return Math.max(0, 100 - claim - previous);
  };

  const handleInputChange = async (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // If PO is cleared, reset total claim percentage
    if (name === 'po_number' && !value) {
      setTotalClaimPercentage(0);
    }

    // If supplier is selected, fetch supplier details and PO numbers
    if (name === 'supplier_id' && value) {
      try {
        const response = await customersSuppliersAPI.getById(value);
        const supplierData = response.data.record || response.data;
        setSelectedSupplier(supplierData);
        
        // Fetch PO numbers for this supplier
        await fetchPoNumbers(value);
        
        // Clear PO selection and items when supplier changes
        setFormData(prev => ({
          ...prev,
          po_number: '',
          items: [],
          claim_percentage: 100
        }));
        setSelectedPO(null);
        setTotalClaimPercentage(0);
      } catch (error) {
        console.error('Error fetching supplier details:', error);
        setSelectedSupplier(null);
      }
    } else if (name === 'supplier_id' && !value) {
      setSelectedSupplier(null);
      setPoNumbers([]);
      setFormData(prev => ({
        ...prev,
        po_number: '',
        items: [],
        claim_percentage: 100
      }));
      setSelectedPO(null);
      setTotalClaimPercentage(0);
    }
  };

  const handlePOChange = async (e) => {
    const poNumber = e.target.value;
    
    if (!poNumber) {
      // Reset to default when PO is cleared
      setFormData(prev => ({
        ...prev,
        po_number: '',
        claim_percentage: 100
      }));
      setSelectedPO(null);
      setTotalClaimPercentage(0);
      return;
    }

    setFormData(prev => ({
      ...prev,
      po_number: poNumber
    }));

    if (poNumber) {
      try {
        // Pass current invoice ID if editing to exclude it from already invoiced calculation
        const params = invoiceId ? { exclude_invoice_id: invoiceId } : {};
        const response = await purchaseTaxInvoicesAPI.getPoItems(poNumber, params);
        const poData = response.data.po || {};
        const items = response.data.items || [];
        const totalClaim = parseFloat(response.data.total_claim_percentage || 0);
        
        setSelectedPO(poData);
        setTotalClaimPercentage(totalClaim);
        
        // Set default Amount of Claim (%) = 100 - previous claims
        // If no previous claims, default = 100
        const defaultClaimPercentage = Math.max(0, 100 - totalClaim);
        
          // Auto-fill items from PO
          // IMPORTANT: Use remaining_quantity (Total Quantity - Already Invoiced Quantity) as default
          // Calculate total_price based on remaining_quantity
          setFormData(prev => ({
            ...prev,
            project_number: items[0]?.project_no || '',
            claim_percentage: invoiceId ? prev.claim_percentage : defaultClaimPercentage,
            items: items.map((item, index) => {
              // Calculate remaining_quantity correctly: total_quantity - already_invoiced_quantity
              // Use remaining_quantity from backend if it exists and is a valid number, otherwise calculate it
              const totalQuantity = parseFloat(item.quantity) || 0;
              const alreadyInvoiced = parseFloat(item.already_invoiced_quantity) || 0;
              
              // IMPORTANT: Check if remaining_quantity exists and is a valid number (including 0)
              // Use nullish coalescing to only fallback if remaining_quantity is null/undefined, not if it's 0
              let remainingQty = 0;
              if (item.remaining_quantity !== null && item.remaining_quantity !== undefined) {
                remainingQty = parseFloat(item.remaining_quantity);
                // If parseFloat returns NaN, fallback to calculation
                if (isNaN(remainingQty)) {
                  remainingQty = Math.max(0, totalQuantity - alreadyInvoiced);
                }
              } else {
                // Calculate: remaining = total - already_invoiced
                remainingQty = Math.max(0, totalQuantity - alreadyInvoiced);
              }
              
              // Ensure remainingQty is never negative
              remainingQty = Math.max(0, remainingQty);
              
              // Get unit price from PO item (unit_price field from purchase_order_items table)
              const unitPrice = parseFloat(item.unit_price) || 0;
              
              // Calculate total_price based on remaining_quantity
              const totalPrice = remainingQty * unitPrice;
              
              return {
                serial_no: index + 1,
                project_no: item.project_no || '',
                part_no: item.part_no || '',
                material_no: item.material_no || '',
                description: item.description || item.inventory_description || '',
                uom: item.uom || '',
                quantity: remainingQty, // Use remaining quantity as default
                max_quantity: remainingQty, // Store the maximum allowed quantity (remaining from PO)
                supplier_unit_price: unitPrice, // Use unit_price from PO
                total_price: totalPrice // Calculate based on remaining_quantity
              };
            })
          }));
        setError('');
      } catch (error) {
        console.error('Error fetching PO items:', error);
        const errorMessage = formatErrorMessages(error);
        setError(errorMessage);
        showToast(errorMessage, 'error');
        setFormData(prev => ({
          ...prev,
          items: []
        }));
      }
    } else {
      setSelectedPO(null);
      setFormData(prev => ({
        ...prev,
        items: []
      }));
    }
  };


  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    
    // If changing quantity, validate it doesn't exceed max_quantity
    if (field === 'quantity') {
      const maxQty = parseFloat(newItems[index].max_quantity) || parseFloat(newItems[index].quantity) || 0;
      const newQty = parseFloat(value) || 0;
      // Restrict to max_quantity if it exists, otherwise use current quantity as max
      newItems[index].quantity = Math.min(newQty, maxQty);
    } else {
      newItems[index][field] = value;
    }
    
    if (field === 'quantity' || field === 'supplier_unit_price') {
      const quantity = parseFloat(newItems[index].quantity) || 0;
      const unitPrice = parseFloat(newItems[index].supplier_unit_price) || 0;
      newItems[index].total_price = quantity * unitPrice;
    }
    
    setFormData(prev => ({
      ...prev,
      items: newItems
    }));
  };

  const addItem = () => {
    const newSerialNo = formData.items.length + 1;
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        serial_no: newSerialNo,
        project_no: formData.project_number || '',
        part_no: '',
        material_no: '',
        description: '',
        uom: '',
        quantity: 0,
        max_quantity: undefined, // Manually added items have no max restriction
        supplier_unit_price: 0,
        total_price: 0
      }]
    }));
  };

  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index).map((item, i) => ({
        ...item,
        serial_no: i + 1
      }))
    }));
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: '' });
    }, 4000);
  };

  const formatErrorMessages = (error) => {
    let errorMessages = [];
    
    // Check for validation errors array
    if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
      error.response.data.errors.forEach(err => {
        if (err.msg || err.message) {
          errorMessages.push(err.msg || err.message);
        }
      });
    }
    
    // Check for single error message
    if (error.response?.data?.message) {
      const message = error.response.data.message;
      // If it's already a combined message or single message, add it
      if (!errorMessages.includes(message)) {
        errorMessages.push(message);
      }
    }
    
    // Check for error field in response
    if (error.response?.data?.error && !errorMessages.includes(error.response.data.error)) {
      errorMessages.push(error.response.data.error);
    }
    
    // If no specific error messages found, add generic ones based on status
    if (errorMessages.length === 0) {
      if (error.response?.status === 400) {
        errorMessages.push('Invalid data provided. Please check all required fields.');
      } else if (error.response?.status === 404) {
        errorMessages.push('The requested resource was not found.');
      } else if (error.response?.status === 409) {
        errorMessages.push('A record with this information already exists.');
      } else if (error.response?.status === 422) {
        errorMessages.push('The provided data is invalid or incomplete.');
      } else if (error.response?.status === 500) {
        errorMessages.push('Server error occurred. Please try again later.');
      } else if (error.message) {
        errorMessages.push(`Network error: ${error.message}`);
      } else {
        errorMessages.push('An unexpected error occurred. Please try again.');
      }
    }
    
    // Combine all error messages into one
    return errorMessages.join(' ');
  };

  const calculateTotals = () => {
    // Subtotal: sum(quantity × unit price)
    const subtotal = formData.items.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.supplier_unit_price) || 0;
      return sum + (quantity * unitPrice);
    }, 0);
    
    // Amount of Claim = Subtotal × %
    const claimPercentage = parseFloat(formData.claim_percentage) || 100;
    const amountOfClaim = subtotal * (claimPercentage / 100);
    
    // VAT (5%) = Amount of Claim × 5%
    const vatAmount = amountOfClaim * 0.05;
    
    // Gross Amount = Amount of Claim + VAT
    const grossTotal = amountOfClaim + vatAmount;

    return { subtotal, amountOfClaim, vatAmount, grossTotal };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Validate total claim percentage doesn't exceed 100%
      if (formData.po_number) {
        const currentClaim = parseFloat(formData.claim_percentage) || 0;
        const totalClaim = totalClaimPercentage + currentClaim;
        
        if (totalClaim > 100) {
          const errorMessage = `Total claim percentage cannot exceed 100%. Current: ${totalClaimPercentage.toFixed(2)}% (previous invoices) + ${currentClaim.toFixed(2)}% (this invoice) = ${totalClaim.toFixed(2)}%`;
          setError(errorMessage);
          showToast(errorMessage, 'error');
          setLoading(false);
          return;
        }
      }

      const payload = {
        ...formData,
        status: 'draft' // إضافة القيمة صراحة
      };
      const response = await purchaseTaxInvoicesAPI.create(payload);
      const successMessage = `Purchase Tax Invoice created successfully! Invoice Number: ${response.data.invoice_number}`;
      setSuccess(successMessage);
      showToast(successMessage, 'success');
      // Reset form
      setFormData({
        invoice_number: '',
        invoice_date: new Date().toISOString().split('T')[0],
        supplier_id: '',
        po_number: '',
        project_number: '',
        claim_percentage: 100,
        items: []
      });
      setSelectedSupplier(null);
      setSelectedPO(null);
      setTotalClaimPercentage(0);
    } catch (error) {
      const errorMessage = formatErrorMessages(error);
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintInvoice = () => {
    // Get the invoice container element
    const invoiceElement = document.querySelector('.purchase-tax-invoice');
    if (!invoiceElement) {
      const errorMessage = 'Invoice content not found. Please ensure the invoice is loaded correctly.';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      return;
    }

    // Clone the element to avoid modifying the original
    const clonedElement = invoiceElement.cloneNode(true);

    // Replace all input fields with their values for printing
    const inputs = clonedElement.querySelectorAll('input');
    inputs.forEach(input => {
      const span = document.createElement('span');
      span.textContent = input.value || '';
      span.style.fontWeight = '600';
      span.style.color = '#000';
      if (input.parentNode) {
        input.parentNode.replaceChild(span, input);
      }
    });

    // Create a hidden iframe for printing
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
      const errorMessage = 'Unable to create print window. Please check your browser settings and try again.';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      return;
    }

    // Get all stylesheets from the current page
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(node => node.outerHTML)
      .join('\n');

    // Write the invoice HTML to the iframe with styles
    iframeDoc.open();
    iframeDoc.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1"/>
          ${styles}
          <title>Purchase Tax Invoice - ${formData.invoice_number}</title>
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
            .supplier-selection-section {
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
            /* Ensure table prints properly */
            .items-table {
              width: 100%;
              border-collapse: collapse;
            }
            .items-table th,
            .items-table td {
              border: 1px solid #000 !important;
              padding: 8px !important;
              text-align: center;
            }
            .items-table .table-header {
              background-color: #e9ecef !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            /* Ensure borders are visible */
            .supplier-info-box,
            .invoice-details-box,
            .totals-box {
              border: 2px solid #000 !important;
              padding: 1rem !important;
            }
            /* Make sure the invoice is visible */
            .purchase-tax-invoice {
              display: block !important;
            }
          </style>
        </head>
        <body>
          ${clonedElement.outerHTML}
        </body>
      </html>
    `);
    iframeDoc.close();

    // Wait for styles and content to load, then print
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (error) {
        console.error('Error printing:', error);
        const errorMessage = formatErrorMessages(error);
        setError(errorMessage);
        showToast(errorMessage, 'error');
      } finally {
        // Cleanup after a short delay to allow print dialog to open
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 500);
      }
    }, 250);
  };

  const handleGeneratePDF = async () => {
    if (!invoiceId) {
      const errorMessage = 'No invoice selected for PDF generation. Please select an invoice first.';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await purchaseTaxInvoicesAPI.generatePDF(invoiceId);
      
      // Create blob and download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Purchase_Tax_Invoice_${formData.invoice_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      const successMessage = 'PDF generated and downloaded successfully!';
      setSuccess(successMessage);
      showToast(successMessage, 'success');
    } catch (error) {
      const errorMessage = formatErrorMessages(error);
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, amountOfClaim, vatAmount, grossTotal } = calculateTotals();

  return (
    <div className="purchase-tax-invoice">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`toast-notification toast-${toast.type}`}>
          <div className="toast-content">
            <i className={`fas ${toast.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} me-2`}></i>
            <span>{toast.message}</span>
          </div>
          <button 
            className="toast-close" 
            onClick={() => setToast({ show: false, message: '', type: '' })}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h2>Purchase Tax Invoice (Supplier Invoice)</h2>
              </div>
              <div className="card-body">
                {error && <div className="alert alert-danger">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}

                <form onSubmit={handleSubmit}>
                  {/* Invoice Header - Matching the design */}
                  <div className="invoice-header-section">
                    <div className="row">
                      <div className="col-md-6">
                        <div className="supplier-info-box">
                          <div className="info-row">
                            <span className="label">Company:</span>
                            <span className="value">
                              {selectedSupplier ? selectedSupplier.company_name : 'Select Supplier'}
                            </span>
                          </div>
                          <div className="info-row">
                            <span className="label">Address:</span>
                            <span className="value">
                              {selectedSupplier ? selectedSupplier.address || '' : ''}
                            </span>
                          </div>
                          <div className="info-row">
                            <span className="label">Contact:</span>
                            <span className="value">
                              {selectedSupplier ? selectedSupplier.phone || '' : ''}
                            </span>
                          </div>
                          <div className="info-row">
                            <span className="label">Email add.:</span>
                            <span className="value">
                              {selectedSupplier ? selectedSupplier.email || '' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="invoice-details-box">
                          <div className="info-row">
                            <span className="label">Inv. No.:</span>
                            <span className="value">
                              <input
                                type="text"
                                name="invoice_number"
                                value={formData.invoice_number}
                                onChange={handleInputChange}
                                className="form-control invoice-input"
                                placeholder="Enter Invoice Number"
                                required
                                disabled={!!invoiceId}
                              />
                            </span>
                          </div>
                          <div className="info-row">
                            <span className="label">Inv. Date:</span>
                            <span className="value">
                              <input
                                type="date"
                                name="invoice_date"
                                value={formData.invoice_date}
                                onChange={handleInputChange}
                                className="form-control invoice-input"
                                required
                                disabled={!!invoiceId}
                              />
                            </span>
                          </div>
                          <div className="info-row">
                            <span className="label">Project no.:</span>
                            <span className="value">
                              <input
                                type="text"
                                name="project_number"
                                value={formData.project_number}
                                onChange={handleInputChange}
                                className="form-control invoice-input"
                                placeholder="Enter Project Number"
                                disabled={!!invoiceId}
                              />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Supplier Selection - Only show if not in view mode */}
                  {!invoiceId && (
                    <div className="supplier-selection-section">
                      <div className="row">
                        <div className="col-md-6">
                          <div className="form-group">
                            <label>Select Supplier:</label>
                            <select
                              name="supplier_id"
                              value={formData.supplier_id}
                              onChange={handleInputChange}
                              className="form-control"
                              required
                            >
                              <option value="">Select Supplier</option>
                              {suppliers.map(supplier => (
                                <option key={supplier.id} value={supplier.id}>
                                  {supplier.company_name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="form-group">
                            <label>PO Number:</label>
                            <select
                              name="po_number"
                              value={formData.po_number}
                              onChange={handlePOChange}
                              className="form-control"
                            >
                              <option value="">Select PO Number</option>
                              {poNumbers.map(po => (
                                <option key={po.po_number} value={po.po_number}>
                                  {po.po_number} - {po.supplier_name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Items Table - Matching the design exactly */}
                  <div className="items-section">
                    <div className="table-responsive">
                      <table className="table table-bordered items-table">
                        <thead>
                          <tr className="table-header">
                            <th>SERI AL NO.</th>
                            <th>PART NO.</th>
                            <th>MATERIAL NO.</th>
                            <th>DESCRIPTION</th>
                            <th>UOM</th>
                            <th>QUANTITY</th>
                            <th>SUPPLIER UNIT PRICE</th>
                            <th>TOTAL PRICE</th>
                            {!invoiceId && <th>Actions</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {formData.items.map((item, index) => (
                            <tr key={index}>
                              <td>{item.serial_no}</td>
                              <td>
                                <input
                                  type="text"
                                  value={item.part_no}
                                  onChange={(e) => handleItemChange(index, 'part_no', e.target.value)}
                                  className="form-control table-input"
                                  disabled={!!invoiceId}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={item.material_no}
                                  onChange={(e) => handleItemChange(index, 'material_no', e.target.value)}
                                  className="form-control table-input"
                                  disabled={!!invoiceId}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={item.description}
                                  onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                  className="form-control table-input"
                                  disabled={!!invoiceId}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={item.uom}
                                  onChange={(e) => handleItemChange(index, 'uom', e.target.value)}
                                  className="form-control table-input"
                                  disabled={!!invoiceId}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                                  className="form-control table-input"
                                  min="0"
                                  max={item.max_quantity || item.quantity}
                                  step="1"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={item.supplier_unit_price}
                                  onChange={(e) => handleItemChange(index, 'supplier_unit_price', parseFloat(e.target.value) || 0)}
                                  className="form-control table-input"
                                  min="0"
                                  step="0.01"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={(parseFloat(item.total_price) || 0).toFixed(2)}
                                  className="form-control table-input"
                                  disabled
                                />
                              </td>
                              {!invoiceId && (
                                <td>
                                  <button
                                    type="button"
                                    onClick={() => removeItem(index)}
                                    className="btn btn-danger btn-sm"
                                  >
                                    Remove
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!invoiceId && (
                      <button
                        type="button"
                        onClick={addItem}
                        className="btn btn-primary"
                      >
                        Add Item
                      </button>
                    )}
                  </div>

                  {/* Amount of Claim */}
                  <div className="claim-section">
                    <div className="row">
                      <div className="col-md-6">
                        <div className="form-group">
                          <label>Amount of Claim (%):</label>
                          <input
                            type="number"
                            name="claim_percentage"
                            value={formData.claim_percentage}
                            onChange={handleInputChange}
                            className="form-control"
                            min="0"
                            max="100"
                            step="0.01"
                            required
                            disabled={!!invoiceId}
                          />
                          {totalClaimPercentage > 0 && (
                            <small className="text-muted">
                              Previous invoices: {totalClaimPercentage.toFixed(2)}%
                            </small>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Totals Section - Matching the design */}
                  <div className="totals-section">
                    <div className="row">
                      <div className="col-md-6"></div>
                      <div className="col-md-6">
                        <div className="totals-box">
                          <div className="total-row">
                            <span className="label">SUB-TOTAL:</span>
                            <span className="value">{formatCurrency(subtotal)}</span>
                          </div>
                          <div className="total-row">
                            <span className="label">Amount of Claim {formData.claim_percentage}%:</span>
                            <span className="value">{formatCurrency(amountOfClaim)}</span>
                          </div>
                          <div className="total-row">
                            <span className="label">VAT 5%:</span>
                            <span className="value">{formatCurrency(vatAmount)}</span>
                          </div>
                          <div className="total-row total-final">
                            <span className="label">TOTAL:</span>
                            <span className="value">{formatCurrency(grossTotal)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {!invoiceId && (
                    <div className="form-actions d-flex gap-2">
                      <button
                        type="submit"
                        className="btn btn-success btn-lg"
                        disabled={loading || formData.items.length === 0}
                      >
                        {loading ? 'Creating Invoice...' : 'Save & Generate Invoice'}
                      </button>
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseTaxInvoice;


