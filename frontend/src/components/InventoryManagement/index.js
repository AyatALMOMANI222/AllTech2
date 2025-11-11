import React, { useState, useEffect } from 'react';
import formatCurrency from '../../utils/formatCurrency';
import './style.scss';

// API base URL - use environment variable or detect production
const API_BASE_URL = process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8000/api');

const InventoryManagement = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const [formData, setFormData] = useState({
    serial_no: '',
    project_no: '',
    date_po: '',
    part_no: '',
    material_no: '',
    description: '',
    uom: '',
    quantity: 0,
    supplier_unit_price: 0.0,
    sold_quantity: 0,
    manufacturer_part_number: '',
    cost_price: 0.0
  });

  useEffect(() => {
    fetchInventory();
  }, [currentPage, searchTerm, showAll, itemsPerPage]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/inventory?search=${searchTerm}`;
      if (!showAll) {
        url += `&page=${currentPage}&limit=${itemsPerPage}`;
      } else {
        url += `&limit=1000`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      setInventory(data.items);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      alert('Error fetching inventory data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = editingItem
        ? `${API_BASE_URL}/inventory/${editingItem.id}`
        : `${API_BASE_URL}/inventory`;
      
      const method = editingItem ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const result = await response.json();
        setShowModal(false);
        setEditingItem(null);
        resetForm();
        fetchInventory();
        
        if (result.calculated_values) {
          alert(
            `${editingItem ? 'Updated' : 'Added'} successfully!\n\n` +
            `Calculated Values:\n` +
            `Total Price: AED ${result.calculated_values.total_price?.toFixed(2) || 0}\n` +
            `Balance: ${result.calculated_values.balance?.toFixed(2) || 0}\n` +
            `Balance Amount: AED ${result.calculated_values.balance_amount?.toFixed(2) || 0}`
          );
        } else {
          alert(editingItem ? 'Inventory item updated successfully!' : 'Inventory item added successfully!');
        }
      } else {
        const error = await response.json();
        alert('Error: ' + (error.message || 'Failed to save inventory item'));
      }
    } catch (error) {
      console.error('Error saving inventory:', error);
      alert('Error saving inventory item');
    } finally {
      setLoading(false);
    }
  };

  const handleView = (item) => {
    setViewingItem(item);
    setShowViewModal(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      serial_no: item.serial_no || '',
      project_no: item.project_no || '',
      date_po: item.date_po || '',
      part_no: item.part_no || '',
      material_no: item.material_no || '',
      description: item.description || '',
      uom: item.uom || '',
      quantity: item.quantity || 0,
      supplier_unit_price: item.supplier_unit_price || 0.0,
      sold_quantity: item.sold_quantity || 0,
      manufacturer_part_number: item.manufacturer_part_number || '',
      cost_price: item.cost_price || 0.0
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this inventory item?')) {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/inventory/${id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          fetchInventory();
          alert('Inventory item deleted successfully!');
        } else {
          alert('Error deleting inventory item');
        }
      } catch (error) {
        console.error('Error deleting inventory:', error);
        alert('Error deleting inventory item');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!importFile) {
      alert('Please select a file to import');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', importFile);

    try {
      const response = await fetch(`${API_BASE_URL}/inventory/import`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (response.ok) {
        setShowImportModal(false);
        setImportFile(null);
        fetchInventory();
        
        if (result.summary) {
          const summary = result.summary;
          // Display the summary message from backend, or build custom message
          const summaryMessage = result.summary_message || 
            `Import Summary: ${summary.records_updated || summary.updated || 0} inventory record(s) updated, ${summary.records_created || summary.inserted || 0} inventory record(s) newly created.`;
          
          alert(
            `Import completed successfully!\n\n` +
            `${summaryMessage}\n\n` +
            `Total Rows Processed: ${summary.total_rows}\n` +
            `Skipped: ${summary.skipped || 0} rows\n\n` +
            `All values auto-calculated by the system!`
          );
        } else {
          alert(`Import completed! ${result.importedItems?.length || 0} items imported successfully.`);
        }
      } else {
        alert('Error importing file: ' + result.message);
      }
    } catch (error) {
      console.error('Error importing file:', error);
      alert('Error importing file');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      serial_no: '',
      project_no: '',
      date_po: '',
      part_no: '',
      material_no: '',
      description: '',
      uom: '',
      quantity: 0,
      supplier_unit_price: 0.0,
      sold_quantity: 0,
      manufacturer_part_number: '',
      cost_price: 0.0
    });
    setEditingItem(null);
  };

  return (
    <div className="inventory-management">
      <div className="inventory-header">
        <div className="header-actions">
          {/* <button 
            className="btn btn-add" 
            onClick={() => { resetForm(); setShowModal(true); }}
          >
            <i className="fas fa-plus"></i>
            <span>Add Item</span>
          </button> */}
          <button 
            className="btn btn-import" 
            onClick={() => setShowImportModal(true)}
          >
            <i className="fas fa-file-excel"></i>
            <span>Import Excel</span>
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="inventory-controls">
        <div className="search-box">
          <i className="fas fa-search search-icon"></i>
          <input
            type="text"
            className="search-input"
            placeholder="Search inventory items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filter-options">
          <div className="checkbox-container">
            <input
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
            <label htmlFor="showAll">Show All Items</label>
          </div>
          
          {!showAll && (
            <div className="items-per-page">
              <label>Items per page:</label>
              <select
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
          )}
        </div>
      </div>

      {/* Items Summary */}
      <div className="inventory-summary">
        <span className="summary-text">
          Showing {inventory.length} item{inventory.length !== 1 ? 's' : ''}
          {!showAll && totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
        </span>
      </div>

      {/* Inventory Table */}
      <div className="inventory-card">
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading...</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Part No</th>
                    <th>Material No</th>
                    <th>Description</th>
                    <th>Quantity</th>
                    <th>Balance</th>
                    <th>Unit Price</th>
                    <th>Cost Price</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Part No">{item.part_no}</td>
                      <td data-label="Material No">{item.material_no}</td>
                      <td data-label="Description" className="description-cell">
                        {item.description}
                      </td>
                      <td data-label="Quantity">{item.quantity}</td>
                      <td data-label="Balance">
                        <span className={`badge ${item.balance > 0 ? 'badge-success' : 'badge-warning'}`}>
                          {item.balance}
                        </span>
                      </td>
                      <td data-label="Unit Price">
                        {formatCurrency(item.supplier_unit_price)}
                      </td>
                      <td data-label="Cost Price">
                        {formatCurrency(item.cost_price)}
                      </td>
                      <td data-label="Actions">
                        <div className="action-buttons">
                          <button
                            className="btn-action btn-view"
                            onClick={() => handleView(item)}
                            title="View Details"
                          >
                            View
                          </button>
                          <button
                            className="btn-action btn-edit"
                            onClick={() => handleEdit(item)}
                            title="Edit"
                          >
                            Edit
                          </button>
                          <button
                            className="btn-action btn-delete"
                            onClick={() => handleDelete(item.id)}
                            title="Delete"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!showAll && totalPages > 1 && (
              <div className="pagination">
                <button 
                  className="pagination-btn"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <i className="fas fa-chevron-left"></i>
                  Previous
                </button>
                
                <div className="pagination-numbers">
                  {[...Array(totalPages)].map((_, index) => (
                    <button
                      key={index + 1}
                      className={`pagination-number ${currentPage === index + 1 ? 'active' : ''}`}
                      onClick={() => setCurrentPage(index + 1)}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
                
                <button 
                  className="pagination-btn"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <i className="fas fa-chevron-right"></i>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* View Details Modal */}
      {showViewModal && viewingItem && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal-container view-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Item Details</h3>
              <button className="btn-close" onClick={() => setShowViewModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Serial No</label>
                  <span>{viewingItem.serial_no || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Project No</label>
                  <span>{viewingItem.project_no || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Date PO</label>
                  <span>{viewingItem.date_po ? new Date(viewingItem.date_po).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Part No</label>
                  <span>{viewingItem.part_no}</span>
                </div>
                <div className="detail-item">
                  <label>Material No</label>
                  <span>{viewingItem.material_no}</span>
                </div>
                <div className="detail-item">
                  <label>UOM</label>
                  <span>{viewingItem.uom || 'N/A'}</span>
                </div>
                <div className="detail-item full-width">
                  <label>Description</label>
                  <span>{viewingItem.description}</span>
                </div>
                <div className="detail-item highlight">
                  <label>Quantity</label>
                  <span>{viewingItem.quantity}</span>
                </div>
                <div className="detail-item highlight">
                  <label>Supplier Unit Price</label>
                  <span>{formatCurrency(viewingItem.supplier_unit_price)}</span>
                </div>
                <div className="detail-item highlight">
                  <label>Total Price</label>
                  <span className="amount">
                    {formatCurrency(viewingItem.total_price)}
                  </span>
                </div>
                <div className="detail-item highlight">
                  <label>Sold Quantity</label>
                  <span>{viewingItem.sold_quantity}</span>
                </div>
                <div className="detail-item highlight">
                  <label>Balance</label>
                  <span className="balance">{viewingItem.balance}</span>
                </div>
                <div className="detail-item highlight">
                  <label>Balance Amount</label>
                  <span className="amount">
                    {formatCurrency(viewingItem.balance_amount)}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Manufacturer Part Number</label>
                  <span>{viewingItem.manufacturer_part_number || 'N/A'}</span>
                </div>
                <div className="detail-item highlight">
                  <label>Cost Price</label>
                  <span className="amount">
                    {formatCurrency(viewingItem.cost_price)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingItem ? 'Edit Inventory Item' : 'Add New Inventory Item'}</h3>
              <button className="btn-close" onClick={() => { setShowModal(false); resetForm(); }}>
                    ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Serial No</label>
                    <input
                      type="text"
                      name="serial_no"
                      value={formData.serial_no}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Project No</label>
                    <input
                      type="text"
                      name="project_no"
                      value={formData.project_no}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Date PO</label>
                    <input
                      type="date"
                      name="date_po"
                      value={formData.date_po}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Part No</label>
                    <input
                      type="text"
                      name="part_no"
                      value={formData.part_no}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Material No</label>
                    <input
                      type="text"
                      name="material_no"
                      value={formData.material_no}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>UOM</label>
                    <input
                      type="text"
                      name="uom"
                      value={formData.uom}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Description</label>
                    <textarea
                      name="description"
                      rows="3"
                      value={formData.description}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Quantity <span className="required">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleInputChange}
                      required
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Supplier Unit Price <span className="required">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      name="supplier_unit_price"
                      value={formData.supplier_unit_price}
                      onChange={handleInputChange}
                      required
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Manufacturer Part Number</label>
                    <input
                      type="text"
                      name="manufacturer_part_number"
                      value={formData.manufacturer_part_number}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Cost Price</label>
                    <input
                      type="number"
                      step="0.01"
                      name="cost_price"
                      value={formData.cost_price}
                      onChange={handleInputChange}
                      min="0"
                    />
                  </div>
                  
                  {editingItem && (
                    <div className="form-group">
                      <label>Sold Quantity</label>
                      <input
                        type="number"
                        step="0.01"
                        name="sold_quantity"
                        value={formData.sold_quantity}
                        onChange={handleInputChange}
                        min="0"
                      />
                    </div>
                  )}
                  
                  <div className="form-group full-width">
                    <div className="info-box">
                      <i className="fas fa-calculator"></i>
                      <div>
                        <strong>Auto-Calculated Fields:</strong>
                        <ul>
                          <li>Total Price = Quantity × Supplier Unit Price</li>
                          {!editingItem && <li>Sold Quantity = 0 (initial value)</li>}
                          <li>Balance = Quantity - Sold Quantity</li>
                          <li>Balance Amount = Balance × Supplier Unit Price</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => { setShowModal(false); resetForm(); }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : (editingItem ? 'Update' : 'Add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => { setShowImportModal(false); setImportFile(null); }}>
          <div className="modal-container import-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Import Inventory from Excel</h3>
              <button className="btn-close" onClick={() => { setShowImportModal(false); setImportFile(null); }}>
                    ×
              </button>
            </div>
            <form onSubmit={handleImport}>
              <div className="modal-body">
                <div className="file-upload">
                  <input
                    type="file"
                    id="fileInput"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setImportFile(e.target.files[0])}
                  />
                  <label htmlFor="fileInput" className="file-label">
                    <i className="fas fa-cloud-upload-alt"></i>
                    <span>{importFile ? importFile.name : 'Choose file (Excel or CSV)'}</span>
                  </label>
                </div>
                <div className="file-info">
                  <p><strong>Required columns:</strong> part_no, material_no, quantity, supplier_unit_price</p>
                  <p><strong>Optional columns:</strong> serial_no, project_no, date_po, description, uom, sold_quantity, manufacturer_part_number, cost_price</p>
                  <p><strong>Auto-calculated:</strong> total_price, balance, balance_amount</p>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => { setShowImportModal(false); setImportFile(null); }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading || !importFile}>
                  {loading ? 'Importing...' : 'Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryManagement;