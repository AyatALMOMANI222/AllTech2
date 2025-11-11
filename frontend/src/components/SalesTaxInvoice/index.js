import React, { useState, useEffect } from 'react';
import { salesTaxInvoicesAPI, customersSuppliersAPI } from '../../services/api';
import formatCurrency from '../../utils/formatCurrency';
import './style.scss';

const SalesTaxInvoice = ({ invoiceId = null }) => {
  const [formData, setFormData] = useState({
    customer_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    customer_po_number: '',
    customer_po_date: '',
    payment_terms: '',
    contract_number: '',
    delivery_terms: '',
    claim_percentage: 100,
    items: []
  });

  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerPONumbers, setCustomerPONumbers] = useState([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // AllTech company information (static)
  const sellerInfo = {
    company_name: "ALL TECH FOR HEAVY EQUIPMENT SPARE PARTS TRADING",
    address: "AL MA'MORAH, KHALIFA INDUSTRIAL ZONE 8 KEZAD, OFFICE IU-65",
    po_box: "P.O BOX 9026 ABU DHABI, UNITED ARAB EMIRATES",
    trn_number: "100477132300003",
    phone: "+971 50 621 3247",
    email: "Info@alltech-defence.ae"
  };

  // Bank account details (static)
  const bankDetails = {
    account_name: "ALL TECH FOR HEAVY EQUIPMENT SPARE PARTS",
    account_number: "12025265820001",
    iban: "AE940030012000000000000",
    swift_code: "ADCBAEAAXXX",
    bank_name: "ABU DHABI COMMERCIAL BANK PJSC, KHALIFA CITY BRANCH, ABU DHABI - UNITED ARAB EMIRATES"
  };

  // Authorized signature (static)
  const authorizedSignature = {
    name: "KHALED SALEH ABDULLA ALHAMMADI"
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Load invoice details if invoiceId is provided (view mode)
  useEffect(() => {
    const loadInvoice = async () => {
      if (!invoiceId) return;
      try {
        setLoading(true);
        const res = await salesTaxInvoicesAPI.getById(invoiceId);
        const inv = res.data.invoice || {};
        const items = res.data.items || [];
        setInvoiceNumber(inv.invoice_number || '');
        setFormData({
          customer_id: inv.customer_id || '',
          invoice_date: inv.invoice_date ? inv.invoice_date.split('T')[0] : (inv.invoice_date || ''),
          customer_po_number: inv.customer_po_number || '',
          customer_po_date: inv.customer_po_date ? inv.customer_po_date.split('T')[0] : (inv.customer_po_date || ''),
          payment_terms: inv.payment_terms || '',
          contract_number: inv.contract_number || '',
          delivery_terms: inv.delivery_terms || '',
          claim_percentage: inv.claim_percentage || 100,
          items: items.map(item => ({
            part_no: item.part_no || '',
            material_no: item.material_no || '',
            project_no: item.project_no || '',
            description: item.description || '',
            quantity: item.quantity || 0,
            unit_price: item.unit_price || 0,
            total_amount: (item.quantity || 0) * (item.unit_price || 0)
          }))
        });
        // Load customer details for display
        if (inv.customer_id) {
          try {
            const custRes = await customersSuppliersAPI.getById(inv.customer_id);
            const customerData = custRes.data.record || custRes.data;
            setSelectedCustomer(customerData);
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

  const fetchCustomers = async () => {
    try {
      const response = await customersSuppliersAPI.getAll({ type: 'customer' });
      console.log('Fetch customers response:', response.data);
      // The API returns { records: [...] }, so we need to access response.data.records
      const customersData = response.data?.records || response.data || [];
      console.log('Customers data:', customersData);
      setCustomers(Array.isArray(customersData) ? customersData : []);
    } catch (error) {
      console.error('Error fetching customers:', error);
      setCustomers([]); // Set empty array on error
    }
  };

  const handleInputChange = async (e) => {
    const { name, value } = e.target;
    console.log('Input change:', name, value);
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // If customer is selected, fetch customer details and PO numbers
    if (name === 'customer_id' && value) {
      console.log('Fetching customer details for ID:', value);
      try {
        const response = await customersSuppliersAPI.getById(value);
        console.log('Customer API Response:', response.data);
        // The API returns { record: customerData }, so we need to access response.data.record
        const customerData = response.data.record || response.data;
        console.log('Customer Data:', customerData);
        setSelectedCustomer(customerData);
        
        // Fetch approved PO numbers for this customer
        try {
          const poRes = await salesTaxInvoicesAPI.getCustomerPONumbers(value);
          const poNumbers = poRes.data || [];
          console.log('PO Numbers:', poNumbers);
          setCustomerPONumbers(Array.isArray(poNumbers) ? poNumbers : []);
        } catch (poErr) {
          console.error('Error fetching PO numbers:', poErr);
          setCustomerPONumbers([]);
        }
        
        // Clear PO selection and items when customer changes
        setFormData(prev => ({
          ...prev,
          customer_po_number: '',
          customer_po_date: '',
          items: []
        }));
        setError('');
      } catch (error) {
        console.error('Error fetching customer details:', error);
        console.error('Error details:', error.response?.data);
        setSelectedCustomer(null);
        setCustomerPONumbers([]);
      }
    } else if (name === 'customer_id' && !value) {
      setSelectedCustomer(null);
      setCustomerPONumbers([]);
      // Clear dependent fields when customer is cleared
      setFormData(prev => ({
        ...prev,
        customer_po_number: '',
        customer_po_date: '',
        items: []
      }));
    }
  };

  const handleCustomerPOChange = async (e) => {
    const poNumber = e.target.value;
    setFormData(prev => ({
      ...prev,
      customer_po_number: poNumber
    }));

    if (poNumber) {
      try {
        const response = await salesTaxInvoicesAPI.getCustomerPOItems(poNumber);
        setFormData(prev => ({
          ...prev,
          items: response.data.map(item => ({
            part_no: item.part_no || '',
            material_no: item.material_no || '',
            project_no: item.project_no || '',
            description: item.description || '',
            quantity: item.quantity || 0,
            unit_price: item.unit_price || 0,
            total_amount: (item.quantity || 0) * (item.unit_price || 0)
          }))
        }));
      } catch (error) {
        console.error('Error fetching customer PO items:', error);
        setError('No items found for this customer PO number');
      }
    } else {
      setFormData(prev => ({
        ...prev,
        items: []
      }));
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total_amount = newItems[index].quantity * newItems[index].unit_price;
    }
    
    setFormData(prev => ({
      ...prev,
      items: newItems
    }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        part_no: '',
        material_no: '',
        project_no: '',
        description: '',
        quantity: 0,
        unit_price: 0,
        total_amount: 0
      }]
    }));
  };

  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + item.total_amount, 0);
    const claimAmount = subtotal * (formData.claim_percentage / 100);
    const vatAmount = claimAmount * 0.05;
    const grossTotal = claimAmount + vatAmount;

    return { subtotal, claimAmount, vatAmount, grossTotal };
  };

  // Convert number to words
  const numberToWords = (num) => {
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const thousands = ['', 'thousand', 'million', 'billion', 'trillion'];

    function convertHundreds(n) {
      let result = '';
      
      if (n > 99) {
        result += ones[Math.floor(n / 100)] + ' hundred';
        n %= 100;
        if (n > 0) result += ' ';
      }
      
      if (n > 19) {
        result += tens[Math.floor(n / 10)];
        n %= 10;
        if (n > 0) result += ' ' + ones[n];
      } else if (n > 9) {
        result += teens[n - 10];
      } else if (n > 0) {
        result += ones[n];
      }
      
      return result;
    }

    if (num === 0) return 'zero';
    
    let result = '';
    let thousandIndex = 0;
    
    while (num > 0) {
      const chunk = num % 1000;
      if (chunk !== 0) {
        const chunkWords = convertHundreds(chunk);
        if (thousandIndex > 0) {
          result = chunkWords + ' ' + thousands[thousandIndex] + (result ? ' ' + result : '');
        } else {
          result = chunkWords;
        }
      }
      num = Math.floor(num / 1000);
      thousandIndex++;
    }
    
    return result;
  };

  // Convert amount to words format (e.g., "AED one thousand two hundred thirty-four and 56/100 Only")
  const convertAmountToWords = (amount) => {
    const wholePart = Math.floor(amount);
    const decimalPart = Math.floor((amount % 1) * 100);
    
    const wholePartWords = numberToWords(wholePart);
    const decimalPartStr = decimalPart.toString().padStart(2, '0');
    
    if (decimalPart > 0) {
      return `AED ${wholePartWords} and ${decimalPartStr}/100 Only`;
    } else {
      return `AED ${wholePartWords} Only`;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await salesTaxInvoicesAPI.create(formData);
      setSuccess(`Invoice created successfully! Invoice Number: ${response.data.invoice_number}`);
      // Reset form
      setFormData({
        customer_id: '',
        invoice_date: new Date().toISOString().split('T')[0],
        customer_po_number: '',
        customer_po_date: '',
        payment_terms: '',
        contract_number: '',
        delivery_terms: '',
        claim_percentage: 100,
        items: []
      });
    } catch (error) {
      setError(error.response?.data?.message || 'Error creating invoice');
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, claimAmount, vatAmount, grossTotal } = calculateTotals();

  return (
    <div className="sales-tax-invoice">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h2>Sales Tax Invoice (Customer Invoice)</h2>
              </div>
              <div className="card-body">
                {error && <div className="alert alert-danger">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}

                 <form onSubmit={handleSubmit}>
                   {/* Company Logo */}
                   <div className="company-logo-section">
                     <div className="logo-container">
                       <div className="logo-frame">
                         <div className="logo-graphic">
                           <div className="logo-section grey-left"></div>
                           <div className="logo-section orange-center"></div>
                           <div className="logo-section grey-right"></div>
                         </div>
                       </div>
                       <div className="logo-text">
                         <div className="logo-title">ALL TeCH DEFENCE</div>
                       </div>
                     </div>
                   </div>

                   {/* Invoice Header */}
                   <div className="invoice-header">
                    <div className="row">
                      <div className="col-md-6">
                        <div className="seller-info">
                          <h4>From</h4>
                          <div className="company-details">
                            <strong>{sellerInfo.company_name}</strong><br />
                            {sellerInfo.address}<br />
                            {sellerInfo.po_box}<br />
                            <strong>TRN No.:</strong> {sellerInfo.trn_number}<br />
                            <strong>Tel:</strong> {sellerInfo.phone}<br />
                            <strong>Email:</strong> {sellerInfo.email}
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="invoice-details">
                          <h4>Tax Invoice</h4>
                          <div className="form-group">
                            <label>Tax Invoice No:</label>
                            {invoiceId ? (
                              <div className="invoice-number-display">{invoiceNumber || 'N/A'}</div>
                            ) : (
                              <>
                                <input type="text" className="form-control screen-only" value="Auto-generated" disabled />
                                <div className="print-only invoice-number-display">{invoiceNumber || 'N/A'}</div>
                              </>
                            )}
                          </div>
                          <div className="form-group">
                            <label>Invoice Date:</label>
                            <input
                              type="date"
                              name="invoice_date"
                              value={formData.invoice_date}
                              onChange={handleInputChange}
                              className="form-control"
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label>Payment Terms:</label>
                            <input
                              type="text"
                              name="payment_terms"
                              value={formData.payment_terms}
                              onChange={handleInputChange}
                              className="form-control"
                              placeholder="e.g., 80% AGAINST DELIVERY OF THE ITEMS"
                            />
                          </div>
                          <div className="form-group">
                            <label>Contract No:</label>
                            <input
                              type="text"
                              name="contract_number"
                              value={formData.contract_number}
                              onChange={handleInputChange}
                              className="form-control"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Customer Information */}
                  <div className="customer-section">
                    <div className="row">
                       <div className="col-md-6">
                         <div className="customer-info">
                           <h4>Customer</h4>
                           <div className="form-group">
                             <label>Customer Name:</label>
                             {invoiceId ? (
                               <div className="customer-name-display">{selectedCustomer?.company_name || 'N/A'}</div>
                             ) : (
                               <>
                                 <select
                                   name="customer_id"
                                   value={formData.customer_id}
                                   onChange={handleInputChange}
                                   className="form-control screen-only"
                                   required
                                 >
                                   <option value="">Select Customer</option>
                                   {Array.isArray(customers) && customers.map(customer => (
                                     <option key={customer.id} value={customer.id}>
                                       {customer.company_name}
                                     </option>
                                   ))}
                                 </select>
                                 <div className="print-only customer-name-display">{selectedCustomer?.company_name || 'N/A'}</div>
                               </>
                             )}
                           </div>
                           
                           {/* Display fetched customer details */}
                           {selectedCustomer ? (
                             <div className="customer-details">
                               <div className="customer-detail-row">
                                 <strong>Name:</strong> {selectedCustomer.company_name || 'N/A'}
                               </div>
                               <div className="customer-detail-row">
                                 <strong>Address:</strong> {selectedCustomer.address || 'N/A'}
                               </div>
                               <div className="customer-detail-row">
                                 <strong>TRN No.:</strong> {selectedCustomer.trn_number || 'N/A'}
                               </div>
                               <div className="customer-detail-row">
                                 <strong>Tel:</strong> {selectedCustomer.phone || 'N/A'}
                               </div>
                               <div className="customer-detail-row">
                                 <strong>Email:</strong> {selectedCustomer.email || 'N/A'}
                               </div>
                               {/* Debug info - remove this later */}
                               {/* <div className="customer-detail-row" style={{fontSize: '10px', color: '#666'}}>
                                 <strong>Debug:</strong> {JSON.stringify(selectedCustomer)}
                               </div> */}
                             </div>
                           ) : (
                             <div className="customer-details">
                               <div className="customer-detail-row">
                                 <em>Select a customer to view details</em>
                               </div>
                             </div>
                           )}
                         </div>
                       </div>
                      <div className="col-md-6">
                        <div className="po-details">
                          <h4>Purchase Order Details</h4>
                          <div className="form-group">
                            <label>PO No:</label>
                            {invoiceId ? (
                              <div className="po-number-display">{formData.customer_po_number || 'N/A'}</div>
                            ) : (
                              <>
                                <select
                                  name="customer_po_number"
                                  value={formData.customer_po_number}
                                  onChange={handleCustomerPOChange}
                                  className="form-control screen-only"
                                  disabled={!formData.customer_id}
                                >
                                  <option value="">Select PO Number</option>
                                  {customerPONumbers.map(po => (
                                    <option key={po.id} value={po.po_number}>
                                      {po.po_number} - {new Date(po.created_at).toLocaleDateString()}
                                    </option>
                                  ))}
                                </select>
                                <div className="print-only po-number-display">{formData.customer_po_number || 'N/A'}</div>
                                {customerPONumbers.length === 0 && formData.customer_id && (
                                  <small className="text-muted screen-only">No approved PO found for this customer</small>
                                )}
                              </>
                            )}
                          </div>
                          <div className="form-group">
                            <label>PO Date:</label>
                            <input
                              type="date"
                              name="customer_po_date"
                              value={formData.customer_po_date}
                              onChange={handleInputChange}
                              className="form-control"
                            />
                          </div>
                          <div className="form-group">
                            <label>Delivery Terms:</label>
                            <input
                              type="text"
                              name="delivery_terms"
                              value={formData.delivery_terms}
                              onChange={handleInputChange}
                              className="form-control"
                              placeholder="e.g., DAP"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div className="line-items-section">
                    <h4>Line Items</h4>
                    <div className="table-responsive">
                      <table className="table table-bordered invoice-items-table">
                        <thead>
                          <tr>
                            <th>QTY</th>
                            <th>Part No.</th>
                            <th>Material No.</th>
                            <th>Project No.</th>
                            <th>Description</th>
                            <th>Unit Price (AED)</th>
                            <th>Total Amount (AED)</th>
                            {!invoiceId && <th>Actions</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {formData.items.map((item, index) => (
                            <tr key={index}>
                              <td>
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                                  className="form-control"
                                  min="0"
                                  step="0.01"
                                  readOnly={!!invoiceId}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={item.part_no}
                                  onChange={(e) => handleItemChange(index, 'part_no', e.target.value)}
                                  className="form-control"
                                  readOnly={!!invoiceId}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={item.material_no}
                                  onChange={(e) => handleItemChange(index, 'material_no', e.target.value)}
                                  className="form-control"
                                  readOnly={!!invoiceId}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={item.project_no || ''}
                                  onChange={(e) => handleItemChange(index, 'project_no', e.target.value)}
                                  className="form-control"
                                  readOnly={!!invoiceId}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={item.description}
                                  onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                  className="form-control"
                                  readOnly={!!invoiceId}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={item.unit_price}
                                  onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                  className="form-control"
                                  min="0"
                                  step="0.01"
                                  readOnly={!!invoiceId}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={item.total_amount.toFixed(2)}
                                  className="form-control"
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
                  </div>

                  {/* Financial Summary */}
                  <div className="financial-summary">
                    <div className="row">
                      <div className="col-md-6">
                        <div className="amount-in-words">
                          <h4>Amount in Words</h4>
                          <div className="words-box">
                            {convertAmountToWords(grossTotal)}
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="calculations">
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
                            />
                          </div>
                          <div className="calculation-row">
                            <label>SUB TOTAL (AED):</label>
                            <span>{formatCurrency(subtotal)}</span>
                          </div>
                          <div className="calculation-row">
                            <label>Amount of claim {formData.claim_percentage}%:</label>
                            <span>{formatCurrency(claimAmount)}</span>
                          </div>
                          <div className="calculation-row">
                            <label>VAT (5%):</label>
                            <span>{formatCurrency(vatAmount)}</span>
                          </div>
                          <div className="calculation-row total">
                            <label>Gross Payable Amount:</label>
                            <span>{formatCurrency(grossTotal)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bank Account Details */}
                  <div className="bank-details-section">
                    <div className="row">
                      <div className="col-md-6">
                        <div className="bank-info">
                          <h4>Bank Account Details</h4>
                          <div className="bank-box">
                            <div><strong>Account name:</strong> {bankDetails.account_name}</div>
                            <div><strong>Account No (AED):</strong> {bankDetails.account_number}</div>
                            <div><strong>IBAN No:</strong> {bankDetails.iban}</div>
                            <div><strong>Swift Code:</strong> {bankDetails.swift_code}</div>
                            <div><strong>Name of bank & Address:</strong> {bankDetails.bank_name}</div>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="signature-section">
                          <h4>Authorized Signature</h4>
                          <div className="signature-box">
                            <div><strong>NAME:</strong> {authorizedSignature.name}</div>
                            <div className="signature-line">Signature: _________________</div>
                            <div className="stamp-line">Stamp: _________________</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                   {/* Actions */}
                   <div className="form-actions d-flex gap-2">
                     {!invoiceId && (
                       <button
                         type="submit"
                         className="btn btn-success btn-lg"
                         disabled={loading || formData.items.length === 0}
                       >
                         {loading ? 'Creating Invoice...' : 'Create Invoice'}
                       </button>
                     )}
                   </div>

                   {/* Footer Contact Information */}
                   <div className="footer-section">
                     <div className="contact-info">
                       <div className="contact-item">
                         <i className="fas fa-envelope"></i>
                         <span>Info@alltech-defence.ae</span>
                       </div>
                       <div className="contact-item">
                         <i className="fas fa-box"></i>
                         <span>Po. Box: 9026, Abu Dhabi, U.A.E.</span>
                       </div>
                       <div className="contact-item">
                         <i className="fas fa-globe"></i>
                         <span>www.alltech-defence.com</span>
                       </div>
                     </div>
                     <div className="gradient-bar"></div>
                   </div>
                 </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesTaxInvoice;
