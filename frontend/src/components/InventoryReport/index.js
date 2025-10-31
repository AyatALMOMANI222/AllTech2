import React, { useState, useEffect } from "react";
import "./style.scss";
import { inventoryReportsAPI } from "../../services/api";

const InventoryReport = () => {
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reportData, setReportData] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "serial_no",
    direction: "ASC",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    if (reportDate) {
      fetchReport();
    }
  }, [reportDate, searchTerm, sortConfig]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await inventoryReportsAPI.getReport({
        as_of_date: reportDate,
        search: searchTerm,
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction,
      });
      // The backend returns { report_date, items, summary }
      // Transform to match expected format
      setReportData({
        summary: response.data.summary,
        items: response.data.items,
      });
    } catch (error) {
      console.error("Error fetching inventory report:", error);
      setError("Error loading inventory report");
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    let direction = "ASC";
    if (sortConfig.key === key && sortConfig.direction === "ASC") {
      direction = "DESC";
    }
    setSortConfig({ key, direction });
  };

  const handleExport = async (format = "csv") => {
    try {
      setLoading(true);
      setError("");
      const blob = await inventoryReportsAPI.exportReport({
        as_of_date: reportDate,
        format,
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `inventory_report_${reportDate}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSuccess(`Report exported successfully as ${format.toUpperCase()}`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Error exporting report:", error);
      setError("Error exporting report");
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (item) => {
    console.log("View clicked for item:", item);
    setSelectedItem(item);
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setTimeout(() => setSelectedItem(null), 300);
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return "⇅";
    }
    return sortConfig.direction === "ASC" ? "↑" : "↓";
  };

  return (
    <>
      <div className="inventory-report">
        <div className="report-container">
          <div className="card">
            <div className="card-header">
              <h2>Inventory Report</h2>
            </div>
            <div className="card-body">
              {error && <div className="alert alert-danger">{error}</div>}
              {success && <div className="alert alert-success">{success}</div>}

              <div className="search-filter-section">
                <div className="form-row">
                  <div className="form-group">
                    <label>Report Date (As of):</label>
                    <input
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      className="form-control"
                      max={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  <div className="form-group">
                    <label>Search:</label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search items..."
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>&nbsp;</label>
                    <button
                      onClick={fetchReport}
                      className="btn btn-primary"
                      disabled={loading}
                    >
                      {loading ? "Loading..." : "Generate Report"}
                    </button>
                  </div>
                </div>
              </div>

              {reportData && (
                <>
                  <div className="report-header">
                    <h3>
                      Inventory Report as of{" "}
                      {new Date(reportDate).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </h3>
                    <p className="report-subtitle">
                      Complete inventory status and stock details
                    </p>
                  </div>

                  <div className="summary-section">
                    <div className="summary-grid">
                      <div className="summary-card">
                        <div className="summary-label">Total Items</div>
                        <div className="summary-value">
                          {reportData.summary.total_items}
                        </div>
                      </div>
                      <div className="summary-card">
                        <div className="summary-label">Total Quantity</div>
                        <div className="summary-value">
                          {reportData.summary.total_quantity.toLocaleString(
                            "en-US",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </div>
                      </div>
                      <div className="summary-card">
                        <div className="summary-label">Total Value</div>
                        <div className="summary-value">
                          AED{" "}
                          {reportData.summary.total_value.toLocaleString(
                            "en-US",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </div>
                      </div>
                      <div className="summary-card">
                        <div className="summary-label">Total Balance</div>
                        <div className="summary-value">
                          {reportData.summary.total_balance.toLocaleString(
                            "en-US",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </div>
                      </div>
                      <div className="summary-card">
                        <div className="summary-label">
                          Total Balance Amount
                        </div>
                        <div className="summary-value">
                          AED{" "}
                          {reportData.summary.total_balance_amount.toLocaleString(
                            "en-US",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="items-section">
                    <h4>Inventory Details</h4>
                    <div className="table-responsive">
                      <table className="items-table">
                        <thead>
                          <tr>
                            <th onClick={() => handleSort("serial_no")}>
                              Serial No {getSortIcon("serial_no")}
                            </th>
                            <th onClick={() => handleSort("description")}>
                              Description {getSortIcon("description")}
                            </th>
                            <th onClick={() => handleSort("quantity")}>
                              Quantity {getSortIcon("quantity")}
                            </th>
                            <th onClick={() => handleSort("balance")}>
                              Balance {getSortIcon("balance")}
                            </th>
                            <th onClick={() => handleSort("balance_amount")}>
                              Balance Amount {getSortIcon("balance_amount")}
                            </th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.items.length === 0 ? (
                            <tr>
                              <td colSpan="6" className="text-center">
                                No inventory items found for this date
                              </td>
                            </tr>
                          ) : (
                            reportData.items.map((item, index) => (
                              <tr key={item.id || index}>
                                <td>{item.serial_no || "-"}</td>
                                <td>{item.description || "-"}</td>
                                <td className="text-right">
                                  {parseFloat(
                                    item.quantity || 0
                                  ).toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                                <td className="text-right">
                                  {parseFloat(item.balance || 0).toLocaleString(
                                    "en-US",
                                    {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    }
                                  )}
                                </td>
                                <td className="text-right">
                                  {parseFloat(
                                    item.balance_amount || 0
                                  ).toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                                <td>
                                  <button
                                    className="btn btn-view"
                                    onClick={() => handleViewDetails(item)}
                                    type="button"
                                  >
                                    View
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="report-actions">
                    <button
                      onClick={() => handleExport("csv")}
                      className="btn btn-success"
                      disabled={loading}
                    >
                      Export to CSV
                    </button>
                  </div>
                </>
              )}

              {loading && !reportData && (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Generating report...</p>
                </div>
              )}

              {!reportData && !loading && (
                <div className="empty-state">
                  <p>
                    Select a date and click "Generate Report" to view the
                    inventory report
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showDialog && selectedItem && (
        <div className="modal-wrapper">
          <div className="modal-backdrop" onClick={closeDialog}></div>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Item Details</h3>
                <button
                  className="close-btn"
                  onClick={closeDialog}
                  type="button"
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Serial No:</span>
                    <span className="detail-value">
                      {selectedItem.serial_no || "-"}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Project No:</span>
                    <span className="detail-value">
                      {selectedItem.project_no || "-"}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Date PO:</span>
                    <span className="detail-value">
                      {selectedItem.date_po
                        ? new Date(selectedItem.date_po).toLocaleDateString()
                        : "-"}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Part No:</span>
                    <span className="detail-value">
                      {selectedItem.part_no || "-"}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Material No:</span>
                    <span className="detail-value">
                      {selectedItem.material_no || "-"}
                    </span>
                  </div>
                  <div className="detail-item full-width">
                    <span className="detail-label">Description:</span>
                    <span className="detail-value">
                      {selectedItem.description || "-"}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">UOM:</span>
                    <span className="detail-value">
                      {selectedItem.uom || "-"}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Quantity:</span>
                    <span className="detail-value">
                      {parseFloat(selectedItem.quantity || 0).toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                      )}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Unit Price:</span>
                    <span className="detail-value">
                      AED{" "}
                      {parseFloat(
                        selectedItem.supplier_unit_price || 0
                      ).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Total Price:</span>
                    <span className="detail-value">
                      AED{" "}
                      {parseFloat(selectedItem.total_price || 0).toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                      )}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Sold Quantity:</span>
                    <span className="detail-value">
                      {parseFloat(
                        selectedItem.sold_quantity || 0
                      ).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Balance:</span>
                    <span className="detail-value">
                      {parseFloat(selectedItem.balance || 0).toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                      )}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Balance Amount:</span>
                    <span className="detail-value">
                      AED{" "}
                      {parseFloat(
                        selectedItem.balance_amount || 0
                      ).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={closeDialog}
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          overflow-x: hidden;
        }


        .inventory-report {
          min-height: 100vh;
          background: #f8fafc;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }

        .report-container {
          max-width: 1400px;
          margin: 0 auto;
        }

        .card {
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          overflow: visible;
        }

        .card-header {
          background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%);
          color: #ffffff;
          padding: 24px;
        }

        .card-header h2 {
          font-size: 28px;
          font-weight: 600;
        }

        .card-body {
          padding: 24px;
        }

        .alert {
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 14px;
        }

        .alert-danger {
          background: #fee;
          color: #c33;
          border: 1px solid #fcc;
        }

        .alert-success {
          background: #efe;
          color: #3c3;
          border: 1px solid #cfc;
        }

        .search-filter-section {
          margin-bottom: 30px;
        }

        .form-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .form-group label {
          font-size: 14px;
          font-weight: 500;
          color: #0f172a;
          margin-bottom: 6px;
        }

        .form-control {
          padding: 10px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          transition: all 0.2s;
        }

        .form-control:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #6366f1;
          color: #ffffff;
        }

        .btn-primary:hover:not(:disabled) {
          background: #4f46e5;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        .btn-success {
          background: #10b981;
          color: #ffffff;
        }

        .btn-success:hover:not(:disabled) {
          background: #059669;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .btn-secondary {
          background: #64748b;
          color: #ffffff;
        }

        .btn-secondary:hover {
          background: #475569;
        }

        .btn-view {
          background: #ec4899;
          color: #ffffff;
          padding: 6px 16px;
          font-size: 13px;
        }

        .btn-view:hover {
          background: #db2777;
          transform: translateY(-1px);
        }

        .report-header {
          margin-bottom: 30px;
        }

        .report-header h3 {
          font-size: 22px;
          color: #0f172a;
          margin-bottom: 8px;
        }

        .report-subtitle {
          color: #64748b;
          font-size: 14px;
        }

        .summary-section {
          margin-bottom: 30px;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 16px;
        }

        .summary-card {
          background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%);
          padding: 20px;
          border-radius: 12px;
          color: #ffffff;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .summary-label {
          font-size: 13px;
          opacity: 0.9;
          margin-bottom: 8px;
        }

        .summary-value {
          font-size: 24px;
          font-weight: 700;
        }

        .items-section {
          margin-bottom: 30px;
        }

        .items-section h4 {
          font-size: 18px;
          color: #0f172a;
          margin-bottom: 16px;
        }

        .table-responsive {
          overflow-x: auto;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .items-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 800px;
        }

        .items-table thead {
          background: #f8fafc;
        }

        .items-table th {
          padding: 12px 16px;
          text-align: left;
          font-size: 13px;
          font-weight: 600;
          color: #0f172a;
          border-bottom: 2px solid #e2e8f0;
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
        }

        .items-table th:hover {
          background: #f1f5f9;
        }

        .items-table td {
          padding: 12px 16px;
          font-size: 14px;
          color: #334155;
          border-bottom: 1px solid #e2e8f0;
        }

        .items-table tbody tr:hover {
          background: #f8fafc;
        }

        .text-center {
          text-align: center;
        }

        .text-right {
          text-align: right;
        }

        .report-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .loading-state, .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #64748b;
        }

        .spinner {
          border: 3px solid #e2e8f0;
          border-top: 3px solid #6366f1;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          margin: 0 auto 16px;
        }

     
  .modal-dialog {
    position: relative;
    width: 90%;
    max-width: 700px;
    max-height: 90vh;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
  }
        .modal-wrapper {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 9999;
        }

        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 10000;
        }

        .modal {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 10001;
          width: 90%;
          max-width: 700px;
          max-height: 90vh;
        }

        .modal-content {
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          max-height: 90vh;
          width: 800px !important;
          z-index: 10000000000 !important;
          margin-top:30px
        }

        .modal-header {
          background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%);
          color: #ffffff;
          padding: 20px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-header h3 {
          font-size: 20px;
          font-weight: 600;
        }

        .close-btn {
          background: transparent;
          border: none;
          color: #ffffff;
          font-size: 32px;
          line-height: 1;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .modal-body {
          padding: 24px;
          overflow-y: auto;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .detail-item.full-width {
          grid-column: 1 / -1;
        }

        .detail-label {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .detail-value {
          font-size: 15px;
          color: #0f172a;
          font-weight: 500;
        }

        .modal-footer {
          padding: 16px 24px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        @media (max-width: 768px) {
          .inventory-report {
            padding: 12px;
          }

          .card-header {
            padding: 16px;
          }

          .card-header h2 {
            font-size: 22px;
          }

          .card-body {
            padding: 16px;
          }

          .form-row {
            grid-template-columns: 1fr;
          }

          .summary-grid {
            grid-template-columns: 1fr;
          }

          .modal {
            width: 95%;
          }

          .detail-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
};

export default InventoryReport;
