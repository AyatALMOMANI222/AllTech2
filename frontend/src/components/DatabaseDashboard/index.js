import React, { useState, useEffect } from 'react';
import { databaseDashboardAPI } from '../../services/api';
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
                    : 'No inventory, supplier, or customer data found. Add some data to see it displayed here.'
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
                          {dashboardData.reduce((sum, item) => sum + (item.inventory_balance || 0), 0).toLocaleString()}
                        </h5>
                        <p className="card-text small text-muted">Total Balance</p>
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
                            No data available. {searchTerm ? 'Try different search terms.' : 'Add inventory items to see them here.'}
                          </td>
                        </tr>
                      ) : (
                        dashboardData.map((item, index) => (
                          <tr key={item.id || index} className="data-row">
                            {/* ALLTECH DATABASE Data */}
                            <td className="alltech-data">{item.project_no || '-'}</td>
                            <td className="alltech-data">{item.date_po ? new Date(item.date_po).toLocaleDateString() : '-'}</td>
                            <td className="alltech-data"><strong>{item.part_no || '-'}</strong></td>
                            <td className="alltech-data"><strong>{item.material_no || '-'}</strong></td>
                            <td className="alltech-data">{item.description || '-'}</td>
                            <td className="alltech-data">{item.uom || '-'}</td>
                            
                            {/* SUPPLIER APPROVED PURCHASE ORDER Data */}
                            {/* ⚠️ IMPORTANT: supplierDelivered is found based on order_type='supplier' and status (partially_delivered/delivered_completed) */}
                            {/* Records are displayed regardless of penalty_percentage or penalty_amount values */}
                            {(() => {
                              const supplierApproved = item.purchase_orders?.approved_orders?.find(o => o.order_type === 'supplier');
                              const supplierDelivered = item.purchase_orders?.delivered_orders?.find(o => o.order_type === 'supplier');
                              
                              return (
                                <>
                                  <td className="purchase-data">
                                    {supplierApproved?.quantity || supplierDelivered?.quantity || '-'}
                                  </td>
                                  <td className="purchase-data">
                                    {supplierApproved?.unit_price || supplierDelivered?.unit_price || '-'}
                                  </td>
                                  <td className="purchase-data">
                                    {supplierApproved?.total_price || supplierDelivered?.total_price || '-'}
                                  </td>
                                  <td className="purchase-data">
                                    {supplierApproved?.lead_time || supplierDelivered?.lead_time || '-'}
                                  </td>
                                  <td className="purchase-data">
                                    {supplierApproved?.due_date || supplierDelivered?.due_date || '-'}
                                  </td>
                                  
                                  {/* SUPPLIER DELIVERED PURCHASE ORDER Data */}
                                  <td className="purchase-data">
                                    {supplierDelivered?.delivered_quantity || '-'}
                                  </td>
                                  <td className="purchase-data">
                                    {supplierDelivered?.delivered_unit_price || '-'}
                                  </td>
                                  <td className="purchase-data">
                                    {supplierDelivered?.delivered_total_price || '-'}
                                  </td>
                                  <td className="purchase-data">
                                    {supplierDelivered?.penalty_percentage != null && supplierDelivered?.penalty_percentage !== '' && supplierDelivered?.penalty_percentage !== '0'
                                      ? supplierDelivered.penalty_percentage 
                                      : '0'}
                                  </td>
                                  <td className="purchase-data">
                                    {supplierDelivered?.penalty_amount != null && supplierDelivered?.penalty_amount !== '' && supplierDelivered?.penalty_amount !== '0'
                                      ? supplierDelivered.penalty_amount 
                                      : '0'}
                                  </td>
                                  <td className="purchase-data">
                                    {supplierDelivered?.invoice_no || '-'}
                                  </td>
                                  <td className="purchase-data">
                                    {supplierDelivered?.balance_quantity_undelivered || '-'}
                                  </td>
                                  <td className="purchase-data">
                                    {supplierApproved?.supplier_name || supplierDelivered?.supplier_name || '-'}
                                  </td>
                                </>
                              );
                            })()}
                            
                            {/* CUSTOMER APPROVED SALES ORDER Data */}
                            {/* ⚠️ IMPORTANT: customerDelivered is found based on order_type='customer' and status (partially_delivered/delivered_completed) */}
                            {/* Records are displayed regardless of penalty_percentage or penalty_amount values */}
                            {(() => {
                              const customerApproved = item.purchase_orders?.approved_orders?.find(o => o.order_type === 'customer');
                              const customerDelivered = item.purchase_orders?.delivered_orders?.find(o => o.order_type === 'customer');
                              
                              return (
                                <>
                                  <td className="approved-sales-data">
                                    {customerApproved?.quantity || customerDelivered?.quantity || '-'}
                                  </td>
                                  <td className="approved-sales-data">
                                    {customerApproved?.unit_price || customerDelivered?.unit_price || '-'}
                                  </td>
                                  <td className="approved-sales-data">
                                    {customerApproved?.total_price || customerDelivered?.total_price || '-'}
                                  </td>
                                  <td className="approved-sales-data">
                                    {customerApproved?.lead_time || customerDelivered?.lead_time || '-'}
                                  </td>
                                  <td className="approved-sales-data">
                                    {customerApproved?.due_date || customerDelivered?.due_date || '-'}
                                  </td>
                                  
                                  {/* CUSTOMER DELIVERED SALES ORDER Data */}
                                  <td className="delivered-sales-data">
                                    {customerDelivered?.delivered_quantity || '-'}
                                  </td>
                                  <td className="delivered-sales-data">
                                    {customerDelivered?.delivered_unit_price || '-'}
                                  </td>
                                  <td className="delivered-sales-data">
                                    {customerDelivered?.delivered_total_price || '-'}
                                  </td>
                                  <td className="delivered-sales-data">
                                    {customerDelivered?.penalty_percentage != null && customerDelivered?.penalty_percentage !== '' && customerDelivered?.penalty_percentage !== '0'
                                      ? customerDelivered.penalty_percentage 
                                      : '0'}
                                  </td>
                                  <td className="delivered-sales-data">
                                    {customerDelivered?.penalty_amount != null && customerDelivered?.penalty_amount !== '' && customerDelivered?.penalty_amount !== '0'
                                      ? customerDelivered.penalty_amount 
                                      : '0'}
                                  </td>
                                  <td className="delivered-sales-data">
                                    {customerDelivered?.invoice_no || '-'}
                                  </td>
                                  <td className="delivered-sales-data">
                                    {customerDelivered?.balance_quantity_undelivered || '-'}
                                  </td>
                                  <td className="delivered-sales-data">
                                    {customerApproved?.supplier_name || customerDelivered?.supplier_name || '-'}
                                  </td>
                                </>
                              );
                            })()}
                          </tr>
                        ))
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