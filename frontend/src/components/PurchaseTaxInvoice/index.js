import React, { useState, useEffect } from 'react';
import { purchaseTaxInvoicesAPI, customersSuppliersAPI, purchaseOrdersAPI } from '../../services/api';
import formatCurrency from '../../utils/formatCurrency';
import formatNumber from '../../utils/formatNumber';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
          items: items.map(item => ({
            serial_no: item.serial_no || 1,
            project_no: item.project_no || '',
            part_no: item.part_no || '',
            material_no: item.material_no || '',
            description: item.description || '',
            uom: item.uom || '',
            quantity: parseFloat(item.quantity) || 0,
            supplier_unit_price: parseFloat(item.supplier_unit_price) || 0,
            total_price: parseFloat(item.total_price) || 0
          }))
        });
        // Load supplier details for display
        if (inv.supplier_id) {
          try {
            const supplierRes = await customersSuppliersAPI.getById(inv.supplier_id);
            const supplierData = supplierRes.data.record || supplierRes.data;
            setSelectedSupplier(supplierData);
          } catch (_) {}
        }
      } catch (err) {
        console.error('Error loading invoice:', err);
        setError('Error loading invoice');
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

  const handleInputChange = async (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

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
          items: []
        }));
        setSelectedPO(null);
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
        items: []
      }));
      setSelectedPO(null);
    }
  };

  const handlePOChange = async (e) => {
    const poNumber = e.target.value;
    setFormData(prev => ({
      ...prev,
      po_number: poNumber
    }));

    if (poNumber) {
      try {
        const response = await purchaseTaxInvoicesAPI.getPoItems(poNumber);
        const poData = response.data.po || {};
        const items = response.data.items || [];
        
        setSelectedPO(poData);
        
        // Auto-fill items from PO
        setFormData(prev => ({
          ...prev,
          project_number: items[0]?.project_no || '',
          items: items.map((item, index) => ({
            serial_no: index + 1,
            project_no: item.project_no || '',
            part_no: item.part_no || '',
            material_no: item.material_no || '',
            description: item.description || item.inventory_description || '',
            uom: item.uom || '',
            quantity: 0, // User will enter delivered quantity
            supplier_unit_price: parseFloat(item.unit_price) || 0,
            total_price: 0
          }))
        }));
        setError('');
      } catch (error) {
        console.error('Error fetching PO items:', error);
        setError('No items found for this PO number');
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
    newItems[index][field] = value;
    
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
      const response = await purchaseTaxInvoicesAPI.create(formData);
      setSuccess(`Purchase Tax Invoice created successfully! Invoice Number: ${response.data.invoice_number}`);
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
    } catch (error) {
      setError(error.response?.data?.message || 'Error creating invoice');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintInvoice = () => {
    // Get the invoice container element
    const invoiceElement = document.querySelector('.purchase-tax-invoice');
    if (!invoiceElement) {
      setError('Invoice content not found');
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
      setError('Unable to create print window');
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
        setError('Error printing invoice');
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
      setError('No invoice selected for PDF generation');
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
      
      setSuccess('PDF generated and downloaded successfully!');
    } catch (error) {
      setError('Error generating PDF');
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, amountOfClaim, vatAmount, grossTotal } = calculateTotals();

  return (
    <div className="purchase-tax-invoice">
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
                                  step="0.01"
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
                                  type="text"
                                  value={formatNumber(item.total_price)}
                                  className="form-control table-input"
                                  disabled
                                  readOnly
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
