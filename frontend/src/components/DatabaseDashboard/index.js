import React, { useState, useEffect } from 'react';
import { databaseDashboardAPI } from '../../services/api';
import formatNumber from '../../utils/formatNumber';
import './style.scss';

const DatabaseDashboard = () => {
  const [dashboardData, setDashboardData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [asOfDate, setAsOfDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);

  useEffect(() => {
    fetchDashboard();
  }, [currentPage, searchTerm, asOfDate]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await databaseDashboardAPI.getDashboard({
        search: searchTerm,
        as_of_date: asOfDate,
        page: currentPage,
        limit: itemsPerPage
      });
      setDashboardData(response.data.items || []);
      
      if (response.data.pagination) {
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      setError('Error loading dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      const blob = await databaseDashboardAPI.exportDashboard({
        as_of_date: asOfDate
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `alltech_database_${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting dashboard:', error);
      setError('Error exporting dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="database-dashboard horizontal-layout">
      <div className="dashboard-container">
        <div className="card">
          <div className="card-header">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h2>
                  <i className="fas fa-database me-3"></i>
                  ALLTECH DATABASE
                </h2>
                <p className="mb-0 mt-2 opacity-75">
                  <i className="fas fa-chart-line me-2"></i>
                  Comprehensive Inventory & Transaction Management System
                </p>
              </div>
              <div className="text-end">
                <div className="badge bg-light text-dark px-3 py-2 mb-2">
                  <i className="fas fa-calendar-alt me-2"></i>
                  {new Date().toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
                <div className="small opacity-75">
                  <i className="fas fa-clock me-1"></i>
                  {new Date().toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
          <div className="card-body">
            {error && (
              <div className="alert alert-danger">
                <i className="fas fa-exclamation-triangle me-2"></i>
                {error}
              </div>
            )}

            {/* Professional Filters Section */}
            <div className="filters-section no-print">
              <div className="row g-4 mb-4">
                <div className="col-md-4">
                  <label className="form-label">
                    <i className="fas fa-search me-2"></i>
                    Search Records
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search by part number, material number, description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <small className="form-text text-muted">
                    Search across all inventory and transaction data
                  </small>
                </div>
                <div className="col-md-3">
                  <label className="form-label">
                    <i className="fas fa-calendar me-2"></i>
                    Report Date
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={asOfDate}
                    onChange={(e) => setAsOfDate(e.target.value)}
                  />
                  <small className="form-text text-muted">
                    Show data as of specific date
                  </small>
                </div>
                <div className="col-md-5">
                  <label className="form-label">
                    <i className="fas fa-cogs me-2"></i>
                    Actions
                  </label>
                  <div className="d-flex gap-2 flex-wrap">
                    <button 
                      className="btn btn-primary"
                      onClick={fetchDashboard}
                      disabled={loading}
                    >
                      <i className="fas fa-sync-alt me-2"></i>
                      {loading ? 'Loading...' : 'Refresh Data'}
                    </button>
                    {/* <button 
                      className="btn btn-success"
                      onClick={handleExport}
                      disabled={loading}
                    >
                      <i className="fas fa-file-excel me-2"></i>
                      Export Excel
                    </button> */}
                    <button 
                      className="btn btn-secondary"
                      onClick={handlePrint}
                    >
                      <i className="fas fa-print me-2"></i>
                      Print Report
                    </button>
                  </div>
                  <small className="form-text text-muted">
                    Refresh, export, or print your dashboard data
                  </small>
                </div>
              </div>
            </div>

            {/* Professional Loading and Empty States */}
            {loading && !dashboardData.length ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <h4 className="mt-3 mb-2">
                  <i className="fas fa-database me-2"></i>
                  Loading Dashboard Data
                </h4>
                <p className="text-muted">Please wait while we fetch your inventory and transaction data...</p>
              </div>
            ) : !loading && (!dashboardData || dashboardData.length === 0) ? (
              <div className="text-center py-5">
                <div className="mb-4">
                  <i className="fas fa-database fa-4x text-muted"></i>
                </div>
                <h4 className="mb-3">
                  <i className="fas fa-info-circle me-2"></i>
                  No Data Available
                </h4>
                <p className="text-muted mb-4">
                  {searchTerm 
                    ? 'No records found matching your search criteria. Try adjusting your search terms.' 
                    : 'No purchase order items found. Add purchase orders to see them displayed here.'
                  }
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
            ) : (
              <div>
                {/* Professional Data Summary */}
                <div className="row g-3 mb-4 no-print">
                  <div className="col-md-6">
                    <div className="card bg-light border-0 h-100">
                      <div className="card-body text-center">
                        <i className="fas fa-boxes fa-2x text-primary mb-2"></i>
                        <h5 className="card-title">{dashboardData.length}</h5>
                        <p className="card-text small text-muted">Total Items</p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="card bg-light border-0 h-100">
                      <div className="card-body text-center">
                        <i className="fas fa-chart-line fa-2x text-warning mb-2"></i>
                        <h5 className="card-title">
                          {dashboardData.reduce((sum, item) => sum + (item.po_quantity || 0), 0).toLocaleString()}
                        </h5>
                        <p className="card-text small text-muted">Total PO Quantity</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Professional Table Container */}
                <div className="horizontal-table-container">
                <div className="horizontal-scroll-wrapper">
                  <table className="table table-bordered horizontal-dashboard-table">
                    <thead>
                      {/* Main Header Row */}
                      <tr className="main-header-row">
                        <th colSpan="6" className="alltech-main-header">
                          <div className="alltech-title">ALLTECH DATABASE</div>
                        </th>
                        <th colSpan="5" className="approved-purchase-main-header">
                          <div className="approved-purchase-title">APPROVED PURCHASED ORDER</div>
                        </th>
                        <th colSpan="8" className="supplier-main-header">
                          <div className="supplier-main-content">
                            <div className="supplier-main-title">SUPPLIER</div>
                            <div className="delivered-purchase-subtitle">DELIVERED PURCHASED ORDER</div>
                          </div>
                        </th>
                        <th colSpan="5" className="approved-sales-main-header">
                          <div className="approved-sales-title">APPROVED SALES ORDER</div>
                        </th>
                        <th colSpan="7" className="customer-main-header">
                          <div className="customer-main-content">
                            <div className="customer-main-title">CUSTOMER</div>
                            <div className="delivered-sales-subtitle">DELIVERED SALES ORDER</div>
                          </div>
                        </th>
                      </tr>
                      
                      {/* Column Header Row */}
                      <tr className="column-header-row">
                        {/* ALLTECH DATABASE Columns */}
                        <th className="alltech-col-header">PROJECT NO</th>
                        <th className="alltech-col-header">DATE P.O</th>
                        <th className="alltech-col-header">PART NO</th>
                        <th className="alltech-col-header">MATERIAL NO</th>
                        <th className="alltech-col-header">DESCRIPTION</th>
                        <th className="alltech-col-header">UOM</th>
                        
                        {/* PURCHASE ORDER Columns - Always Visible */}
                        <th className="purchase-col-header">QUANTITY</th>
                        <th className="purchase-col-header">SUPPLIER UNIT PRICE</th>
                        <th className="purchase-col-header">TOTAL PRICE</th>
                        <th className="purchase-col-header">LEAD TIME</th>
                        <th className="purchase-col-header">DUE DATE</th>
                        <th className="purchase-col-header">DELIVERED QUANTITY</th>
                        <th className="purchase-col-header">DELIVERED UNIT PRICE</th>
                        <th className="purchase-col-header">DELIVERED TOTAL PRICE</th>
                        <th className="purchase-col-header">PENALTY %</th>
                        <th className="purchase-col-header">PENALTY AMOUNT</th>
                        <th className="purchase-col-header">SUPPLIER INVOICE NO</th>
                        <th className="purchase-col-header">BALANCE QUANTITY UNDELIVERED</th>
                        <th className="purchase-col-header">SUPPLIER NAME</th>
                        
                        {/* APPROVED SALES ORDER Columns */}
                        <th className="approved-sales-col-header">QUANTITY</th>
                        <th className="approved-sales-col-header">CUSTOMER UNIT PRICE</th>
                        <th className="approved-sales-col-header">TOTAL PRICE</th>
                        <th className="approved-sales-col-header">LEAD TIME</th>
                        <th className="approved-sales-col-header">DUE DATE</th>
                        
                        {/* DELIVERED SALES ORDER Columns */}
                        <th className="delivered-sales-col-header">DELIVERED QUANTITY</th>
                        <th className="delivered-sales-col-header">DELIVERED UNIT PRICE</th>
                        <th className="delivered-sales-col-header">DELIVERED TOTAL PRICE</th>
                        <th className="delivered-sales-col-header">PENALTY %</th>
                        <th className="delivered-sales-col-header">PENALTY AMOUNT</th>
                        <th className="delivered-sales-col-header">INVOICE NO</th>
                        <th className="delivered-sales-col-header">BALANCE QUANTITY UNDELIVERED</th>
                        <th className="delivered-sales-col-header">CUSTOMER NAME</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.length === 0 ? (
                        <tr>
                          <td colSpan="32" className="text-center py-4">
                            No data available. {searchTerm ? 'Try different search terms.' : 'Add purchase orders to see them here.'}
                          </td>
                        </tr>
                      ) : (
                        dashboardData.map((item, index) => {
                          // Each item represents a unique combination of PROJECT NO, PART NO, MATERIAL NO, DESCRIPTION, UOM
                          // Multiple PO items with the same values for these fields are combined into a single row
                          // The item may contain multiple POs (supplier and/or customer) with different statuses
                          
                          // Check if item has supplier or customer orders based on aggregated values
                          // Use aggregated values directly from backend (supplier_po_quantity, customer_po_quantity, etc.)
                          // For customer orders without linked suppliers, supplier_po_quantity will be NULL, so hasSupplierApproved will be false
                          // Also check approvedOrders array for supplier orders
                          const hasSupplierApprovedFromBackend = item.supplier_po_quantity != null && item.supplier_po_quantity !== '' && parseFloat(item.supplier_po_quantity) > 0;
                          // Get additional info from arrays (for lead_time, due_date, po_number, etc.)
                          const approvedOrders = item.purchase_orders?.approved_orders || [];
                          const deliveredOrders = item.purchase_orders?.delivered_orders || [];
                          
                          // Filter by order type (supplier or customer)
                          const supplierApprovedOrders = approvedOrders.filter(o => o.order_type === 'supplier');
                          const supplierDeliveredOrders = deliveredOrders.filter(o => o.order_type === 'supplier');
                          const customerApprovedOrders = approvedOrders.filter(o => o.order_type === 'customer');
                          const customerDeliveredOrders = deliveredOrders.filter(o => o.order_type === 'customer');
                          
                          // Check if we have supplier approved orders from the array
                          const hasSupplierApprovedFromArray = supplierApprovedOrders.length > 0;
                          const hasSupplierApproved = hasSupplierApprovedFromBackend || hasSupplierApprovedFromArray;
                          const hasSupplierDelivered = item.supplier_delivered_quantity != null && item.supplier_delivered_quantity !== '' && parseFloat(item.supplier_delivered_quantity) > 0;
                          const hasCustomerApproved = item.customer_po_quantity && parseFloat(item.customer_po_quantity) > 0;
                          const hasCustomerDelivered = item.customer_delivered_quantity && parseFloat(item.customer_delivered_quantity) > 0;
                          
                          // Check PO status separately for supplier and customer
                          // Use separate status fields from backend, or fall back to general status
                          // For customer orders without linked suppliers, supplier_po_status will be NULL
                          // For standalone supplier orders, check supplierApprovedOrders for status
                          let supplierStatus = item.supplier_po_status;
                          if (supplierStatus == null && supplierApprovedOrders.length > 0) {
                            // If supplier_po_status is NULL but we have supplier approved orders, use status from orders
                            supplierStatus = supplierApprovedOrders[0]?.status || null;
                          }
                          if (supplierStatus == null && item.po_status && (item.order_type === 'supplier' || (typeof item.order_type === 'string' && item.order_type.includes('supplier')))) {
                            supplierStatus = item.po_status;
                          }
                          const customerStatus = item.customer_po_status || item.po_status;
                          
                          // Check if supplier is approved - use status or check if we have approved orders
                          // If we have supplier approved orders, consider it approved even if status is not set
                          const supplierIsApproved = (supplierStatus && ['approved', 'partially_delivered', 'delivered_completed'].includes(supplierStatus)) || 
                            (hasSupplierApproved && supplierApprovedOrders.length > 0);
                          const supplierIsDelivered = supplierStatus && ['partially_delivered', 'delivered_completed'].includes(supplierStatus);
                          
                          const customerIsApproved = customerStatus && ['approved', 'partially_delivered', 'delivered_completed'].includes(customerStatus);
                          const customerIsDelivered = customerStatus && ['partially_delivered', 'delivered_completed'].includes(customerStatus);
                          
                          // Build supplier approved data object - show if has supplier approved data AND status is approved/delivered
                          // Calculate quantity from approved_orders_data (actual database values) instead of aggregated sum
                          const supplierApprovedQuantity = supplierApprovedOrders.length > 0
                            ? supplierApprovedOrders.reduce((sum, order) => sum + (parseFloat(order.quantity) || 0), 0)
                            : (item.supplier_po_quantity || 0);
                          const supplierApprovedUnitPrice = supplierApprovedOrders.length > 0
                            ? (supplierApprovedOrders[0]?.unit_price || item.supplier_po_unit_price || 0)
                            : (item.supplier_po_unit_price || 0);
                          const supplierApprovedTotalPrice = supplierApprovedQuantity * supplierApprovedUnitPrice;
                          
                          const supplierApproved = (hasSupplierApproved && supplierIsApproved) ? {
                            ...item,
                            po_quantity: supplierApprovedQuantity,
                            po_unit_price: supplierApprovedUnitPrice,
                            po_total_price: supplierApprovedTotalPrice,
                            lead_time: supplierApprovedOrders[0]?.lead_time || item.lead_time || '',
                            due_date: supplierApprovedOrders.length > 0 && supplierApprovedOrders[0]?.due_date ? supplierApprovedOrders[0].due_date : null,
                            customer_supplier_name: supplierApprovedOrders[0]?.supplier_name || item.supplier_name || item.customer_supplier_name || '',
                            po_number: supplierApprovedOrders.length > 0 
                              ? supplierApprovedOrders.map(o => o.po_number).filter(Boolean).join(', ')
                              : (item.po_number || ''),
                            order_type: 'supplier',
                            status: supplierApprovedOrders[0]?.status || supplierStatus || 'approved'
                          } : null;
                          
                          // Build supplier delivered data object - show if has supplier delivered data AND status is delivered
                          // Calculate delivered quantity from delivered_orders_data (actual database values) instead of aggregated sum
                          const supplierDeliveredQuantity = supplierDeliveredOrders.length > 0
                            ? supplierDeliveredOrders.reduce((sum, order) => sum + (parseFloat(order.delivered_quantity) || 0), 0)
                            : (item.supplier_delivered_quantity || 0);
                          const supplierDeliveredUnitPrice = supplierDeliveredOrders.length > 0
                            ? (supplierDeliveredOrders[0]?.delivered_unit_price || item.supplier_delivered_unit_price || 0)
                            : (item.supplier_delivered_unit_price || 0);
                          const supplierDeliveredTotalPrice = supplierDeliveredOrders.length > 0
                            ? supplierDeliveredOrders.reduce((sum, order) => sum + (parseFloat(order.delivered_total_price) || 0), 0)
                            : (item.supplier_delivered_total_price || 0);
                          // Calculate balance quantity undelivered: ORDERED QUANTITY - DELIVERED QUANTITY
                          const supplierBalanceQuantityUndelivered = supplierApprovedQuantity - supplierDeliveredQuantity;
                          
                          const supplierDelivered = (hasSupplierDelivered && supplierIsDelivered) ? {
                            ...item,
                            delivered_quantity: supplierDeliveredQuantity,
                            delivered_unit_price: supplierDeliveredUnitPrice,
                            delivered_total_price: supplierDeliveredTotalPrice,
                            penalty_percentage: item.supplier_penalty_percentage || null,
                            penalty_amount: item.supplier_penalty_amount || 0,
                            invoice_no: item.supplier_invoice_no || '',
                            balance_quantity_undelivered: supplierBalanceQuantityUndelivered,
                            customer_supplier_name: supplierDeliveredOrders[0]?.supplier_name || item.supplier_name || item.customer_supplier_name || '',
                            po_number: supplierDeliveredOrders.length > 0
                              ? supplierDeliveredOrders.map(o => o.po_number).filter(Boolean).join(', ')
                              : (item.po_number || ''),
                            order_type: 'supplier',
                            status: supplierDeliveredOrders[0]?.status || supplierStatus || 'partially_delivered'
                          } : null;
                          
                          // Build customer approved data object - show if has customer approved data AND status is approved/delivered
                          // Calculate quantity from approved_orders_data (actual database values) instead of aggregated sum
                          const customerApprovedQuantity = customerApprovedOrders.length > 0
                            ? customerApprovedOrders.reduce((sum, order) => sum + (parseFloat(order.quantity) || 0), 0)
                            : (item.customer_po_quantity || 0);
                          const customerApprovedUnitPrice = customerApprovedOrders.length > 0
                            ? (customerApprovedOrders[0]?.unit_price || item.customer_po_unit_price || 0)
                            : (item.customer_po_unit_price || 0);
                          const customerApprovedTotalPrice = customerApprovedQuantity * customerApprovedUnitPrice;
                          
                          const customerApproved = (hasCustomerApproved && customerIsApproved) ? {
                            ...item,
                            po_quantity: customerApprovedQuantity,
                            po_unit_price: customerApprovedUnitPrice,
                            po_total_price: customerApprovedTotalPrice,
                            lead_time: customerApprovedOrders[0]?.lead_time || item.lead_time || '',
                            due_date: customerApprovedOrders.length > 0 && customerApprovedOrders[0]?.due_date ? customerApprovedOrders[0].due_date : null,
                            customer_supplier_name: customerApprovedOrders[0]?.supplier_name || item.customer_supplier_name || '',
                            po_number: customerApprovedOrders.length > 0
                              ? customerApprovedOrders.map(o => o.po_number).filter(Boolean).join(', ')
                              : (item.po_number || ''),
                            order_type: 'customer',
                            status: customerApprovedOrders[0]?.status || customerStatus || 'approved'
                          } : null;
                          
                          // Build customer delivered data object - show if has customer delivered data AND status is delivered
                          // Calculate delivered quantity from delivered_orders_data (actual database values) instead of aggregated sum
                          const customerDeliveredQuantity = customerDeliveredOrders.length > 0
                            ? customerDeliveredOrders.reduce((sum, order) => sum + (parseFloat(order.delivered_quantity) || 0), 0)
                            : (item.customer_delivered_quantity || 0);
                          const customerDeliveredUnitPrice = customerDeliveredOrders.length > 0
                            ? (customerDeliveredOrders[0]?.delivered_unit_price || item.customer_delivered_unit_price || 0)
                            : (item.customer_delivered_unit_price || 0);
                          const customerDeliveredTotalPrice = customerDeliveredOrders.length > 0
                            ? customerDeliveredOrders.reduce((sum, order) => sum + (parseFloat(order.delivered_total_price) || 0), 0)
                            : (item.customer_delivered_total_price || 0);
                          // Calculate balance quantity undelivered: ORDERED QUANTITY - DELIVERED QUANTITY
                          const customerBalanceQuantityUndelivered = customerApprovedQuantity - customerDeliveredQuantity;
                          
                          const customerDelivered = (hasCustomerDelivered && customerIsDelivered) ? {
                            ...item,
                            delivered_quantity: customerDeliveredQuantity,
                            delivered_unit_price: customerDeliveredUnitPrice,
                            delivered_total_price: customerDeliveredTotalPrice,
                            penalty_percentage: item.customer_penalty_percentage || null,
                            penalty_amount: item.customer_penalty_amount || 0,
                            invoice_no: item.customer_invoice_no || '',
                            balance_quantity_undelivered: customerBalanceQuantityUndelivered,
                            customer_supplier_name: customerDeliveredOrders[0]?.supplier_name || item.customer_supplier_name || '',
                            po_number: customerDeliveredOrders.length > 0
                              ? customerDeliveredOrders.map(o => o.po_number).filter(Boolean).join(', ')
                              : (item.po_number || ''),
                            order_type: 'customer',
                            status: customerDeliveredOrders[0]?.status || customerStatus || 'partially_delivered'
                          } : null;
                          
                          return (
                          <tr key={item.id || index} className="data-row">
                              {/* ALLTECH DATABASE Data (from PO item) */}
                            <td className="alltech-data">{item.project_no || '-'}</td>
                            <td className="alltech-data">{item.date_po ? new Date(item.date_po).toLocaleDateString() : '-'}</td>
                            <td className="alltech-data"><strong>{item.part_no || '-'}</strong></td>
                            <td className="alltech-data"><strong>{item.material_no || '-'}</strong></td>
                            <td className="alltech-data">{item.description || '-'}</td>
                            <td className="alltech-data">{item.uom || '-'}</td>
                            
                              {/* SUPPLIER APPROVED PURCHASE ORDER Data (status IN ('approved', 'partially_delivered', 'delivered_completed')) */}
                              {/* NOTE: Delivered POs also appear here - they are NOT removed from approved section */}
                              <td className="purchase-data" title={supplierApproved?.po_number ? `PO: ${supplierApproved.po_number}` : ''}>
                                {supplierApproved?.po_quantity || '-'}
                                  </td>
                                  <td className="purchase-data">
                                {supplierApproved?.po_unit_price ? formatNumber(supplierApproved.po_unit_price) : '-'}
                                  </td>
                                  <td className="purchase-data">
                                {supplierApproved?.po_total_price ? formatNumber(supplierApproved.po_total_price) : '-'}
                                  </td>
                                  <td className="purchase-data">
                                {supplierApproved?.lead_time || '-'}
                                  </td>
                                  <td className="purchase-data">
                                {(() => {
                                  // Check if all items are delivered (quantity == delivered_quantity for all items)
                                  // This is true when status is 'delivered_completed' AND balance_quantity_undelivered is 0 (or very close to 0)
                                  // Account for floating point precision issues
                                  const isCompleted = supplierStatus === 'delivered_completed' && 
                                    (supplierBalanceQuantityUndelivered === 0 || Math.abs(supplierBalanceQuantityUndelivered) < 0.01);
                                  
                                  if (isCompleted) {
                                    return <span style={{ fontWeight: 'bold' }}>Completed</span>;
                                  }
                                  
                                  // Show due_date with red color if overdue
                                  // Only show if there are values for APPROVED PURCHASED ORDER
                                  const dueDate = supplierApproved?.due_date;
                                  if (dueDate) {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const due = new Date(dueDate);
                                    due.setHours(0, 0, 0, 0);
                                    const isOverdue = due < today;
                                    
                                    return (
                                      <span style={{ color: isOverdue ? 'red' : 'inherit' }}>
                                        {dueDate}
                                      </span>
                                    );
                                  }
                                  
                                  return '-';
                                })()}
                                  </td>
                                  
                              {/* SUPPLIER DELIVERED PURCHASE ORDER Data (status IN ('partially_delivered', 'delivered_completed')) */}
                              {/* NOTE: These POs ALSO appear in the APPROVED section above */}
                              {/* Show delivered data when PO is delivered, even if some values are 0 */}
                              <td className="purchase-data" title={supplierDelivered?.po_number ? `PO: ${supplierDelivered.po_number} (${supplierDelivered.po_status})` : ''}>
                                {supplierDelivered && (supplierDelivered.delivered_quantity !== null && supplierDelivered.delivered_quantity !== undefined)
                                  ? supplierDelivered.delivered_quantity
                                  : '-'}
                                  </td>
                                  <td className="purchase-data">
                                {supplierDelivered && (supplierDelivered.delivered_unit_price !== null && supplierDelivered.delivered_unit_price !== undefined)
                                  ? formatNumber(supplierDelivered.delivered_unit_price)
                                  : '-'}
                                  </td>
                                  <td className="purchase-data">
                                {supplierDelivered && (supplierDelivered.delivered_total_price !== null && supplierDelivered.delivered_total_price !== undefined)
                                  ? formatNumber(supplierDelivered.delivered_total_price)
                                  : '-'}
                                  </td>
                                  <td className="purchase-data">
                                {supplierDelivered && supplierDelivered.penalty_percentage != null && supplierDelivered.penalty_percentage !== '' && supplierDelivered.penalty_percentage !== '0'
                                      ? formatNumber(supplierDelivered.penalty_percentage)
                                  : supplierDelivered ? '0.00' : '-'}
                                  </td>
                                  <td className="purchase-data">
                                {supplierDelivered && supplierDelivered.penalty_amount != null && supplierDelivered.penalty_amount !== '' && supplierDelivered.penalty_amount !== '0'
                                      ? formatNumber(supplierDelivered.penalty_amount)
                                  : supplierDelivered ? '0.00' : '-'}
                                  </td>
                              <td className="purchase-data" title={supplierDelivered?.invoice_no ? `Invoice: ${supplierDelivered.invoice_no}` : ''}>
                                    {supplierDelivered?.invoice_no || '-'}
                                  </td>
                                  <td className="purchase-data">
                                {supplierDelivered && (supplierDelivered.balance_quantity_undelivered !== null && supplierDelivered.balance_quantity_undelivered !== undefined)
                                  ? supplierDelivered.balance_quantity_undelivered
                                  : '-'}
                                  </td>
                              <td className="purchase-data" title={supplierApproved?.customer_supplier_name ? `${supplierApproved.customer_supplier_name} (${supplierApproved.po_number})` : supplierApproved?.po_number || supplierDelivered?.po_number || ''}>
                                {supplierApproved?.customer_supplier_name || supplierDelivered?.customer_supplier_name || '-'}
                                  </td>
                              
                              {/* CUSTOMER APPROVED SALES ORDER Data (status IN ('approved', 'partially_delivered', 'delivered_completed')) */}
                              {/* NOTE: Delivered POs also appear here - they are NOT removed from approved section */}
                              <td className="approved-sales-data" title={customerApproved?.po_number ? `PO: ${customerApproved.po_number}` : ''}>
                                {customerApproved?.po_quantity || '-'}
                                  </td>
                                  <td className="approved-sales-data">
                                {customerApproved?.po_unit_price ? formatNumber(customerApproved.po_unit_price) : '-'}
                                  </td>
                                  <td className="approved-sales-data">
                                {customerApproved?.po_total_price ? formatNumber(customerApproved.po_total_price) : '-'}
                                  </td>
                                  <td className="approved-sales-data">
                                {customerApproved?.lead_time || '-'}
                                  </td>
                                  <td className="approved-sales-data">
                                {(() => {
                                  // Check if all items are delivered (quantity == delivered_quantity for all items)
                                  // This is true when status is 'delivered_completed' AND balance_quantity_undelivered is 0 (or very close to 0)
                                  // Account for floating point precision issues
                                  const isCompleted = customerStatus === 'delivered_completed' && 
                                    (customerBalanceQuantityUndelivered === 0 || Math.abs(customerBalanceQuantityUndelivered) < 0.01);
                                  
                                  if (isCompleted) {
                                    return <span style={{ fontWeight: 'bold' }}>Completed</span>;
                                  }
                                  
                                  // Show due_date with red color if overdue
                                  // Only show if there are values for APPROVED PURCHASED ORDER
                                  const dueDate = customerApproved?.due_date;
                                  if (dueDate) {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const due = new Date(dueDate);
                                    due.setHours(0, 0, 0, 0);
                                    const isOverdue = due < today;
                                    
                                    return (
                                      <span style={{ color: isOverdue ? 'red' : 'inherit' }}>
                                        {dueDate}
                                      </span>
                                    );
                                  }
                                  
                                  return '-';
                                })()}
                                  </td>
                                  
                              {/* CUSTOMER DELIVERED SALES ORDER Data (status IN ('partially_delivered', 'delivered_completed')) */}
                              {/* NOTE: These POs ALSO appear in the APPROVED section above */}
                              {/* Show delivered data when PO is delivered, even if some values are 0 */}
                              <td className="delivered-sales-data" title={customerDelivered?.po_number ? `PO: ${customerDelivered.po_number} (${customerDelivered.po_status})` : ''}>
                                {customerDelivered && (customerDelivered.delivered_quantity !== null && customerDelivered.delivered_quantity !== undefined)
                                  ? customerDelivered.delivered_quantity
                                  : '-'}
                                  </td>
                                  <td className="delivered-sales-data">
                                {customerDelivered && (customerDelivered.delivered_unit_price !== null && customerDelivered.delivered_unit_price !== undefined)
                                  ? formatNumber(customerDelivered.delivered_unit_price)
                                  : '-'}
                                  </td>
                                  <td className="delivered-sales-data">
                                {customerDelivered && (customerDelivered.delivered_total_price !== null && customerDelivered.delivered_total_price !== undefined)
                                  ? formatNumber(customerDelivered.delivered_total_price)
                                  : '-'}
                                  </td>
                                  <td className="delivered-sales-data">
                                {customerDelivered && customerDelivered.penalty_percentage != null && customerDelivered.penalty_percentage !== '' && customerDelivered.penalty_percentage !== '0'
                                      ? formatNumber(customerDelivered.penalty_percentage)
                                  : customerDelivered ? '0.00' : '-'}
                                  </td>
                                  <td className="delivered-sales-data">
                                {customerDelivered && customerDelivered.penalty_amount != null && customerDelivered.penalty_amount !== '' && customerDelivered.penalty_amount !== '0'
                                      ? formatNumber(customerDelivered.penalty_amount)
                                  : customerDelivered ? '0.00' : '-'}
                                  </td>
                              <td className="delivered-sales-data" title={customerDelivered?.invoice_no ? `Invoice: ${customerDelivered.invoice_no}` : ''}>
                                    {customerDelivered?.invoice_no || '-'}
                                  </td>
                                  <td className="delivered-sales-data">
                                {customerDelivered && (customerDelivered.balance_quantity_undelivered !== null && customerDelivered.balance_quantity_undelivered !== undefined)
                                  ? customerDelivered.balance_quantity_undelivered
                                  : '-'}
                                  </td>
                              <td className="delivered-sales-data" title={customerApproved?.customer_supplier_name ? `${customerApproved.customer_supplier_name} (${customerApproved.po_number})` : customerApproved?.po_number || customerDelivered?.po_number || ''}>
                                {customerApproved?.customer_supplier_name || customerDelivered?.customer_supplier_name || '-'}
                                  </td>
                            </tr>
                              );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="row mt-4 no-print">
                    <div className="col-12">
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="text-muted">
                          Showing page {currentPage} of {totalPages} ({dashboardData.length} items)
                        </div>
                        <nav>
                          <ul className="pagination mb-0">
                            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                              <button 
                                className="page-link" 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                              >
                                <i className="fas fa-chevron-left"></i> Previous
                              </button>
                            </li>
                            <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                              <button 
                                className="page-link" 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                              >
                                Next <i className="fas fa-chevron-right"></i>
                              </button>
                            </li>
                          </ul>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}

                {/* Professional Footer */}
                <div className="row mt-4 no-print">
                  <div className="col-12">
                    <div className="card bg-light border-0">
                      <div className="card-body text-center py-3">
                        <p className="mb-0 text-muted">
                          <i className="fas fa-info-circle me-2"></i>
                          Report generated on {new Date().toLocaleString()} | 
                          <span className="ms-2">
                            <i className="fas fa-database me-1"></i>
                            ALLTECH Database Management System
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseDashboard;