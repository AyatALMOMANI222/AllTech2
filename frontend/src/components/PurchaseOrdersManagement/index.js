import React, { useState, useEffect } from "react";
import "./style.scss";
import {
  salesTaxInvoicesAPI,
  purchaseTaxInvoicesAPI,
} from "../../services/api";
import SalesTaxInvoice from "../SalesTaxInvoice";
import PurchaseTaxInvoice from "../PurchaseTaxInvoice";

const PurchaseOrdersManagement = () => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showInvoicesModal, setShowInvoicesModal] = useState(false);
  const [invoicesForPO, setInvoicesForPO] = useState([]);
  const [viewInvoiceId, setViewInvoiceId] = useState(null);
  const [showInvoiceViewModal, setShowInvoiceViewModal] = useState(false);
  const invoiceModalBodyRef = React.useRef(null);
  const [showSupplierInvoicesModal, setShowSupplierInvoicesModal] =
    useState(false);
  const [supplierInvoicesForPO, setSupplierInvoicesForPO] = useState([]);
  const [viewSupplierInvoiceId, setViewSupplierInvoiceId] = useState(null);
  const [showSupplierInvoiceViewModal, setShowSupplierInvoiceViewModal] =
    useState(false);
  const supplierInvoiceModalBodyRef = React.useRef(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [customersSuppliers, setCustomersSuppliers] = useState([]);
  const [importFile, setImportFile] = useState(null);
  const [importedItems, setImportedItems] = useState([]);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    po_number: "",
    order_type: "customer",
    customer_supplier_id: "",
    status: "approved",
    penalty_percentage: "",
    due_date: "",
    delivered_quantity: "",
    delivered_unit_price: "",
    delivered_total_price: "",
  });

  // Generate a default PO number
  const generatePONumber = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `PO-${timestamp}-${random}`;
  };

  useEffect(() => {
    fetchPurchaseOrders();
    fetchCustomersSuppliers();
  }, [currentPage, showAll, itemsPerPage]);

  const fetchPurchaseOrders = async () => {
    setLoading(true);
    try {
      let url = `http://localhost:8000/api/purchase-orders`;
      if (!showAll) {
        url += `?page=${currentPage}&limit=${itemsPerPage}`;
      } else {
        url += `?limit=1000`;
      }

      const response = await fetch(url);
      const data = await response.json();
      setPurchaseOrders(data.orders);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
      alert("Error fetching purchase orders data");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomersSuppliers = async () => {
    try {
      const response = await fetch(
        "http://localhost:8000/api/purchase-orders/customers-suppliers/list"
      );
      const data = await response.json();
      setCustomersSuppliers(data);
    } catch (error) {
      console.error("Error fetching customers/suppliers:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const newData = {
        ...prev,
        [name]: value,
      };

      // Auto-calculate delivered_total_price when delivered_quantity or delivered_unit_price changes
      if (name === "delivered_quantity" || name === "delivered_unit_price") {
        const quantity =
          name === "delivered_quantity"
            ? parseFloat(value) || 0
            : parseFloat(prev.delivered_quantity) || 0;
        const unitPrice =
          name === "delivered_unit_price"
            ? parseFloat(value) || 0
            : parseFloat(prev.delivered_unit_price) || 0;
        newData.delivered_total_price = (quantity * unitPrice).toFixed(2);
      }

      return newData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = editingOrder
        ? `http://localhost:8000/api/purchase-orders/${editingOrder.id}`
        : "http://localhost:8000/api/purchase-orders";

      const method = editingOrder ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowModal(false);
        setEditingOrder(null);
        setFormData({
          po_number: "",
          order_type: "customer",
          customer_supplier_id: "",
          status: "approved",
          penalty_percentage: "",
          penalty_amount: "",
          balance_quantity_undelivered: "",
          due_date: "",
          delivered_quantity: "",
          delivered_unit_price: "",
          delivered_total_price: "",
        });
        fetchPurchaseOrders();
        alert(
          editingOrder
            ? "Purchase order updated successfully!"
            : "Purchase order created successfully!"
        );
      } else {
        const error = await response.json();
        alert("Error: " + (error.message || "Failed to save purchase order"));
      }
    } catch (error) {
      console.error("Error saving purchase order:", error);
      alert("Error saving purchase order");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (order) => {
    setEditingOrder(order);
    setFormData({
      po_number: order.po_number,
      order_type: order.order_type,
      customer_supplier_id: order.customer_supplier_id,
      status: order.status,
      penalty_percentage: order.penalty_percentage || "",
      due_date: order.due_date || "",
      delivered_quantity: order.delivered_quantity || "",
      delivered_unit_price: order.delivered_unit_price || "",
      delivered_total_price: order.delivered_total_price || "",
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (
      window.confirm("Are you sure you want to delete this purchase order?")
    ) {
      setLoading(true);
      try {
        const response = await fetch(
          `http://localhost:8000/api/purchase-orders/${id}`,
          {
            method: "DELETE",
          }
        );

        if (response.ok) {
          fetchPurchaseOrders();
          alert("Purchase order deleted successfully!");
        } else {
          alert("Error deleting purchase order");
        }
      } catch (error) {
        console.error("Error deleting purchase order:", error);
        alert("Error deleting purchase order");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleViewDetails = async (order) => {
    try {
      const response = await fetch(
        `http://localhost:8000/api/purchase-orders/${order.id}`
      );
      const data = await response.json();
      setSelectedOrder(data);
      setShowDetailsModal(true);
    } catch (error) {
      console.error("Error fetching order details:", error);
      alert("Error fetching order details");
    }
  };

  const handleViewInvoices = async (order) => {
    try {
      const res = await salesTaxInvoicesAPI.getByPONumber(order.po_number);
      const list = res.data?.invoices || res.data || [];
      setInvoicesForPO(Array.isArray(list) ? list : []);
      setShowInvoicesModal(true);
    } catch (err) {
      console.error("Error fetching invoices for PO:", err);
      alert("Error fetching invoices for this PO");
    }
  };

  const openInvoiceView = (invoiceId) => {
    setViewInvoiceId(invoiceId);
    setShowInvoiceViewModal(true);
  };

  const handleViewSupplierInvoices = async (order) => {
    try {
      const res = await purchaseTaxInvoicesAPI.getByPONumber(order.po_number);
      const list = res.data?.invoices || res.data || [];
      setSupplierInvoicesForPO(Array.isArray(list) ? list : []);
      setShowSupplierInvoicesModal(true);
    } catch (err) {
      console.error("Error fetching supplier invoices for PO:", err);
      alert("Error fetching supplier invoices for this PO");
    }
  };

  const openSupplierInvoiceView = (invoiceId) => {
    setViewSupplierInvoiceId(invoiceId);
    setShowSupplierInvoiceViewModal(true);
  };

  const printInvoiceOnly = () => {
    if (!invoiceModalBodyRef.current) return;
    const invoiceNode =
      invoiceModalBodyRef.current.querySelector(".sales-tax-invoice");
    if (!invoiceNode) return;

    // Create a hidden iframe and write the invoice HTML into it, then print
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!iframeDoc) return;

    const styles = Array.from(
      document.querySelectorAll('link[rel="stylesheet"], style')
    )
      .map((node) => node.outerHTML)
      .join("\n");

    iframeDoc.open();
    iframeDoc.write(
      `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>${styles}<title>Invoice</title><style>@page{size:auto;margin:12mm;} html,body{background:#fff !important;} .modal, .modal-backdrop{display:none !important;}</style></head><body>${invoiceNode.outerHTML}</body></html>`
    );
    iframeDoc.close();

    // Ensure styles and content load before printing
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        // Cleanup after a short delay to allow print dialog to open
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 500);
      }
    }, 100);
  };

  const downloadInvoice = () => {
    if (!invoiceModalBodyRef.current) return;
    const invoiceNode =
      invoiceModalBodyRef.current.querySelector(".sales-tax-invoice");
    if (!invoiceNode) return;

    const styles = Array.from(
      document.querySelectorAll('link[rel="stylesheet"], style')
    )
      .map((node) => node.outerHTML)
      .join("\n");

    const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>${styles}<title>Invoice</title><style>html,body{background:#fff !important;}</style></head><body>${invoiceNode.outerHTML}</body></html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${viewInvoiceId || "preview"}.html`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  };

  const printSupplierInvoiceOnly = () => {
    if (!supplierInvoiceModalBodyRef.current) return;
    const invoiceNode = supplierInvoiceModalBodyRef.current.querySelector(
      ".purchase-tax-invoice"
    );
    if (!invoiceNode) return;

    // Create a hidden iframe and write the invoice HTML into it, then print
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!iframeDoc) return;

    const styles = Array.from(
      document.querySelectorAll('link[rel="stylesheet"], style')
    )
      .map((node) => node.outerHTML)
      .join("\n");

    iframeDoc.open();
    iframeDoc.write(
      `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>${styles}<title>Invoice</title><style>@page{size:auto;margin:12mm;} html,body{background:#fff !important;} .modal, .modal-backdrop{display:none !important;}</style></head><body>${invoiceNode.outerHTML}</body></html>`
    );
    iframeDoc.close();

    // Ensure styles and content load before printing
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        // Cleanup after a short delay to allow print dialog to open
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 500);
      }
    }, 100);
  };

  const downloadSupplierInvoice = () => {
    if (!supplierInvoiceModalBodyRef.current) return;
    const invoiceNode = supplierInvoiceModalBodyRef.current.querySelector(
      ".purchase-tax-invoice"
    );
    if (!invoiceNode) return;

    const styles = Array.from(
      document.querySelectorAll('link[rel="stylesheet"], style')
    )
      .map((node) => node.outerHTML)
      .join("\n");

    const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>${styles}<title>Invoice</title><style>html,body{background:#fff !important;}</style></head><body>${invoiceNode.outerHTML}</body></html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `purchase-invoice-${viewSupplierInvoiceId || "preview"}.html`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!importFile) {
      alert("Please select a file to import");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", importFile);

    try {
      const response = await fetch(
        "http://localhost:8000/api/purchase-orders/import",
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (response.ok) {
        setShowImportModal(false);
        setImportedItems(result.items);
        // Generate a default PO number for imported data
        setFormData((prev) => ({
          ...prev,
          po_number: generatePONumber(),
        }));
        setShowVerificationModal(true);
        alert(
          `Import completed! ${result.items.length} items processed. Please verify the data.`
        );
      } else {
        alert("Error importing file: " + result.message);
      }
    } catch (error) {
      console.error("Error importing file:", error);
      alert("Error importing file");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveImportedData = async () => {
    if (!formData.po_number) {
      alert("Please enter a PO Number");
      return;
    }
    if (!formData.customer_supplier_id) {
      alert("Please select a customer/supplier first");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        "http://localhost:8000/api/purchase-orders",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...formData,
            items: importedItems,
          }),
        }
      );

      if (response.ok) {
        setShowVerificationModal(false);
        setImportedItems([]);
        setFormData({
          po_number: "",
          order_type: "customer",
          customer_supplier_id: "",
          status: "approved",
        });
        fetchPurchaseOrders();
        alert("Purchase order created successfully with imported data!");
      } else {
        const error = await response.json();
        alert("Error saving imported data: " + error.message);
      }
    } catch (error) {
      console.error("Error saving imported data:", error);
      alert("Error saving imported data");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      po_number: "",
      order_type: "customer",
      customer_supplier_id: "",
      status: "approved",
      penalty_percentage: "",
      due_date: "",
      delivered_quantity: "",
      delivered_unit_price: "",
      delivered_total_price: "",
    });
    setEditingOrder(null);
  };

  const handleDownloadVerifiedData = () => {
    if (importedItems.length === 0) {
      alert("No data to download");
      return;
    }

    // Get the customer/supplier name
    let csName = "Not Selected";
    if (formData.customer_supplier_id) {
      const selectedCS = customersSuppliers.find(
        (cs) => cs.id == formData.customer_supplier_id
      );
      if (selectedCS) {
        csName = selectedCS.company_name || selectedCS.name || "Unknown";
      }
    }

    // Calculate totals
    const totalQuantity = importedItems.reduce(
      (sum, item) => sum + (parseFloat(item.quantity) || 0),
      0
    );
    const totalAmount = importedItems.reduce(
      (sum, item) => sum + (parseFloat(item.total_price) || 0),
      0
    );

    // Create HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Purchase Order - ${formData.po_number}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #333;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 3px solid #007bff;
              padding-bottom: 20px;
            }
            .header h1 {
              margin: 0;
              color: #007bff;
              font-size: 28px;
            }
            .header h2 {
              margin: 5px 0 0 0;
              color: #666;
              font-size: 18px;
              font-weight: normal;
            }
            .info-section {
              display: flex;
              justify-content: space-between;
              margin-bottom: 30px;
              gap: 20px;
            }
            .info-box {
              flex: 1;
              border: 2px solid #007bff;
              padding: 15px;
              border-radius: 8px;
              background-color: #f8f9fa;
            }
            .info-row {
              margin-bottom: 10px;
            }
            .info-row:last-child {
              margin-bottom: 0;
            }
            .info-label {
              font-weight: bold;
              color: #007bff;
              display: inline-block;
              min-width: 120px;
            }
            .info-value {
              color: #333;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            .items-table thead {
              background-color: #007bff;
              color: white;
            }
            .items-table th {
              padding: 12px 8px;
              text-align: center;
              font-weight: bold;
              border: 1px solid #0056b3;
              font-size: 11px;
            }
            .items-table td {
              padding: 10px 8px;
              border: 1px solid #ddd;
              text-align: center;
              font-size: 10px;
            }
            .items-table tbody tr:nth-child(even) {
              background-color: #f8f9fa;
            }
            .items-table tbody tr:hover {
              background-color: #e3f2fd;
            }
            .totals-section {
              display: flex;
              justify-content: flex-end;
              margin-top: 20px;
            }
            .totals-box {
              border: 2px solid #28a745;
              padding: 15px;
              border-radius: 8px;
              background-color: #f8f9fa;
              min-width: 300px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 10px;
              font-size: 14px;
            }
            .total-row:last-child {
              margin-bottom: 0;
              padding-top: 10px;
              border-top: 2px solid #28a745;
              font-weight: bold;
              font-size: 16px;
              color: #28a745;
            }
            .total-label {
              font-weight: 600;
            }
            .total-value {
              font-weight: 600;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              text-align: center;
              color: #666;
              font-size: 12px;
            }
            @media print {
              body {
                margin: 0;
              }
              .items-table {
                page-break-inside: auto;
              }
              .items-table tr {
                page-break-inside: avoid;
                page-break-after: auto;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Purchase Order</h1>
            <h2>Verified Import Data</h2>
          </div>

          <div class="info-section">
            <div class="info-box">
              <div class="info-row">
                <span class="info-label">PO Number:</span>
                <span class="info-value">${formData.po_number || "N/A"}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Order Type:</span>
                <span class="info-value">${
                  formData.order_type === "customer"
                    ? "Customer PO (Sales)"
                    : "Supplier PO (Purchase)"
                }</span>
              </div>
              <div class="info-row">
                <span class="info-label">${
                  formData.order_type === "customer"
                    ? "Customer Name"
                    : "Supplier Name"
                }:</span>
                <span class="info-value" style="font-weight: 600; color: #007bff;">${csName}</span>
              </div>
            </div>
            <div class="info-box">
              <div class="info-row">
                <span class="info-label">Total Items:</span>
                <span class="info-value">${importedItems.length}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Generated Date:</span>
                <span class="info-value">${new Date().toLocaleDateString()}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Status:</span>
                <span class="info-value" style="font-weight: 600; text-transform: uppercase;">${
                  formData.status
                }</span>
              </div>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Serial No</th>
                <th>Project No</th>
                <th>Date PO</th>
                <th>Part No</th>
                <th>Material No</th>
                <th>Description</th>
                <th>UOM</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total Price</th>
                <th>Comments</th>
              </tr>
            </thead>
            <tbody>
              ${importedItems
                .map(
                  (item) => `
                <tr>
                  <td>${item.serial_no || ""}</td>
                  <td>${item.project_no || ""}</td>
                  <td>${item.date_po || ""}</td>
                  <td>${item.part_no || ""}</td>
                  <td>${item.material_no || ""}</td>
                  <td>${item.description || ""}</td>
                  <td>${item.uom || ""}</td>
                  <td>${item.quantity || ""}</td>
                  <td>$${parseFloat(item.unit_price || 0).toFixed(2)}</td>
                  <td>$${parseFloat(item.total_price || 0).toFixed(2)}</td>
                  <td>${item.comments || ""}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>

          <div class="totals-section">
            <div class="totals-box">
              <div class="total-row">
                <span class="total-label">Total Quantity:</span>
                <span class="total-value">${totalQuantity.toFixed(2)}</span>
              </div>
              <div class="total-row">
                <span class="total-label">Total Amount:</span>
                <span class="total-value">$${totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>This is a computer-generated document. No signature is required.</p>
            <p>Generated on ${new Date().toLocaleString()} | AllTech Business Management System</p>
          </div>
        </body>
      </html>
    `;

    // Create a hidden iframe for printing
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!iframeDoc) {
      alert("Unable to create print window");
      return;
    }

    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    // Wait for content to load, then print (user can save as PDF)
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (error) {
        console.error("Error printing:", error);
        alert("Error generating PDF");
      } finally {
        // Cleanup after a short delay to allow print dialog to open
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 500);
      }
    }, 250);
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      approved: "bg-success",
      delivered: "bg-info",
    };
    return `badge ${statusClasses[status] || "bg-secondary"}`;
  };

  const getOrderTypeIcon = (orderType) => {
    return orderType === "customer" ? "fas fa-shopping-cart" : "fas fa-truck";
  };

  // Filter and search logic
  const getFilteredPurchaseOrders = () => {
    let filtered = [...purchaseOrders];

    // Filter by type
    if (typeFilter !== "all") {
      filtered = filtered.filter((order) => order.order_type === typeFilter);
    }

    // Search functionality
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((order) => {
        const poNumber = order.po_number || "";
        const customerSupplierName = order.customer_supplier_name || "";
        return (
          poNumber.toLowerCase().includes(searchLower) ||
          customerSupplierName.toLowerCase().includes(searchLower)
        );
      });
    }

    return filtered;
  };

  return (
    <div className="purchase-orders-management">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h2>Purchase Orders Management</h2>
              <div>
                {/* <button 
                  className="btn btn-success me-2" 
                  onClick={() => { resetForm(); setShowModal(true); }}
                >
                  <i className="fas fa-plus"></i> New PO
                </button> */}
                <button
                  className="btn btn-info"
                  onClick={() => setShowImportModal(true)}
                >
                  <i className="fas fa-file-excel"></i> Import Excel
                </button>
              </div>
            </div>

            {/* Filter and Search Controls */}
            <div className="row mb-3">
              <div className="col-md-4">
                <div className="card">
                  <div className="card-body py-2">
                    <div className="d-flex align-items-center">
                      <label
                        className="form-label mb-0 me-2"
                        style={{ minWidth: "60px" }}
                      >
                        <i className="fas fa-filter"></i> Filter:
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                      >
                        <option value="all">All Types</option>
                        <option value="customer">Customer PO</option>
                        <option value="supplier">Supplier PO</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-md-8">
                <div className="card">
                  <div className="card-body py-2">
                    <div className="d-flex align-items-center">
                      <label
                        className="form-label mb-0 me-2"
                        style={{ minWidth: "60px" }}
                      >
                        <i className="fas fa-search"></i> Search:
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Search by PO Number or Customer/Supplier name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Items Summary */}
            <div className="row mb-2">
              <div className="col-12">
                <div className="d-flex justify-content-between align-items-center">
                  <span className="text-muted">
                    Showing {getFilteredPurchaseOrders().length} of{" "}
                    {purchaseOrders.length} order
                    {purchaseOrders.length !== 1 ? "s" : ""}
                    {!showAll &&
                      totalPages > 1 &&
                      ` (Page ${currentPage} of ${totalPages})`}
                    <small className="ms-2 text-info">
                      <i className="fas fa-info-circle"></i> Scroll horizontally
                      to see all columns
                    </small>
                  </span>
                  {showAll && (
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => setShowAll(false)}
                    >
                      <i className="fas fa-list"></i> Show Paginated View
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Purchase Orders Table */}
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
                      <table className="table table-striped table-hover">
                        <thead className="table-dark">
                          <tr>
                            <th>PO Number</th>
                            <th>Type</th>
                            <th>Customer/Supplier</th>
                            <th>Created Date</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getFilteredPurchaseOrders().map((order) => (
                            <tr key={order.id}>
                              <td>{order.po_number}</td>
                              <td>
                                <i
                                  className={`${getOrderTypeIcon(
                                    order.order_type
                                  )} me-1`}
                                ></i>
                                {order.order_type === "customer"
                                  ? "Customer PO"
                                  : "Supplier PO"}
                              </td>
                              <td>{order.customer_supplier_name}</td>
                              <td>
                                {new Date(
                                  order.created_at
                                ).toLocaleDateString()}
                              </td>
                              <td>
                                <button
                                  className="btn btn-sm btn-info me-1"
                                  onClick={() => handleViewDetails(order)}
                                  title="View Details"
                                >
View Details                                </button>
                                {order.order_type === "customer" && (
                                  <button
                                    className="btn btn-sm btn-warning me-1"
                                    onClick={() => handleViewInvoices(order)}
                                    title="View Invoices"
                                  >
                                    View 
                                  </button>
                                )}
                                {order.order_type === "supplier" && (
                                  <button
                                    className="btn btn-sm btn-warning me-1"
                                    onClick={() =>
                                      handleViewSupplierInvoices(order)
                                    }
                                    title="View Invoices"
                                  >
                                    View{" "}
                                  </button>
                                )}
                                <button
                                  className="btn btn-sm btn-primary me-1"
                                  onClick={() => handleEdit(order)}
                                  title="Edit"
                                >
                                  Edit{" "}
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleDelete(order.id)}
                                  title="Delete"
                                >
                                  Delete{" "}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {!showAll && totalPages > 1 && (
                      <nav aria-label="Purchase Orders pagination">
                        <ul className="pagination justify-content-center">
                          <li
                            className={`page-item ${
                              currentPage === 1 ? "disabled" : ""
                            }`}
                          >
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
                              className={`page-item ${
                                currentPage === index + 1 ? "active" : ""
                              }`}
                            >
                              <button
                                className="page-link"
                                onClick={() => setCurrentPage(index + 1)}
                              >
                                {index + 1}
                              </button>
                            </li>
                          ))}
                          <li
                            className={`page-item ${
                              currentPage === totalPages ? "disabled" : ""
                            }`}
                          >
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingOrder
                    ? "Edit Purchase Order"
                    : "Create New Purchase Order"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                >×</button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">PO Number *</label>
                      <input
                        type="text"
                        className="form-control"
                        name="po_number"
                        value={formData.po_number}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Order Type *</label>
                      <div className="d-flex gap-3">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="order_type"
                            value="customer"
                            checked={formData.order_type === "customer"}
                            onChange={handleInputChange}
                          />
                          <label className="form-check-label">
                            <i className="fas fa-shopping-cart me-1"></i>
                            Customer PO (Sales)
                          </label>
                        </div>
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="order_type"
                            value="supplier"
                            checked={formData.order_type === "supplier"}
                            onChange={handleInputChange}
                          />
                          <label className="form-check-label">
                            <i className="fas fa-truck me-1"></i>Supplier PO
                            (Purchase)
                          </label>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Customer/Supplier *</label>
                      <select
                        className="form-control"
                        name="customer_supplier_id"
                        value={formData.customer_supplier_id}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">Select Customer/Supplier</option>
                        {customersSuppliers
                          .filter((cs) => cs.type === formData.order_type)
                          .map((cs) => (
                            <option key={cs.id} value={cs.id}>
                              {cs.company_name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Status</label>
                      <select
                        className="form-control"
                        name="status"
                        value={formData.status}
                        onChange={handleInputChange}
                      >
                        <option value="approved">Approved</option>
                        <option value="delivered">Delivered</option>
                      </select>
                    </div>
                  </div>

                  {/* Additional Fields for Delivered Status */}
                  {formData.status === "delivered" && (
                    <div className="row">
                      <div className="col-12">
                        <hr className="my-3" />
                        <h6 className="text-primary mb-3">
                          <i className="fas fa-truck me-2"></i>
                          Delivery Information
                        </h6>
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Penalty %</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control"
                          name="penalty_percentage"
                          value={formData.penalty_percentage || ""}
                          onChange={handleInputChange}
                          placeholder="Enter penalty percentage"
                        />
                        <small className="form-text text-muted">
                          Optional penalty percentage
                        </small>
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Delivered Quantity</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control"
                          name="delivered_quantity"
                          value={formData.delivered_quantity || ""}
                          onChange={handleInputChange}
                          placeholder="Enter delivered quantity"
                          disabled={!editingOrder}
                        />
                        <small className="form-text text-muted">
                          {editingOrder
                            ? "Quantity actually delivered"
                            : "Only available when editing existing orders"}
                        </small>
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">
                          Delivered Unit Price
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control"
                          name="delivered_unit_price"
                          value={formData.delivered_unit_price || ""}
                          onChange={handleInputChange}
                          placeholder="Enter delivered unit price"
                          disabled={!editingOrder}
                        />
                        <small className="form-text text-muted">
                          {editingOrder
                            ? "Unit price for delivered items"
                            : "Only available when editing existing orders"}
                        </small>
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">
                          Delivered Total Price
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          name="delivered_total_price"
                          value={formData.delivered_total_price || ""}
                          readOnly
                          placeholder="Auto-calculated"
                          disabled={!editingOrder}
                        />
                        <small className="form-text text-muted">
                          {editingOrder
                            ? "Automatically calculated: Delivered Quantity × Delivered Unit Price"
                            : "Only available when editing existing orders"}
                        </small>
                      </div>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? "Saving..." : editingOrder ? "Update" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Import Purchase Order from Excel
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                  }}
                >×</button>
              </div>
              <form onSubmit={handleImport}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Select Excel File</label>
                    <input
                      type="file"
                      className="form-control"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => setImportFile(e.target.files[0])}
                    />
                    <div className="form-text">
                      <strong>Required columns:</strong> SERIAL NO (or
                      po_number), PROJECT NO, DATE P.O (or date_po), PART NO,
                      MATERIAL NO, DESCRIPTION, UOM, QUANTITY, UNIT PRICE (or
                      supplier_unit_price), TOTAL PRICE, LEAD TIME, DUE DATE,
                      COMMENTS
                      <br />
                      {/* <strong>Optional columns:</strong> PENALTY %, PENALTY AMOUNT, INVOICE NO, BALANCE QUANTITY UNDELIVERED<br/> */}
                      <small className="text-muted">
                        Note: Column names are flexible - both formats are
                        accepted
                      </small>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowImportModal(false);
                      setImportFile(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading || !importFile}
                  >
                    {loading ? "Importing..." : "Import"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Data Verification Modal */}
      {showVerificationModal && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Verify Imported Data</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowVerificationModal(false);
                    setImportedItems([]);
                  }}
                >×</button>
              </div>
              <div className="modal-body">
                <div className="row mb-3">
                  <div className="col-md-4">
                    <label className="form-label">PO Number *</label>
                    <input
                      type="text"
                      className="form-control"
                      name="po_number"
                      value={formData.po_number}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Order Type</label>
                    <div className="d-flex gap-3">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="order_type"
                          value="customer"
                          checked={formData.order_type === "customer"}
                          onChange={handleInputChange}
                        />
                        <label className="form-check-label">Customer PO</label>
                      </div>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="order_type"
                          value="supplier"
                          checked={formData.order_type === "supplier"}
                          onChange={handleInputChange}
                        />
                        <label className="form-check-label">Supplier PO</label>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Customer/Supplier</label>
                    <select
                      className="form-control"
                      name="customer_supplier_id"
                      value={formData.customer_supplier_id}
                      onChange={handleInputChange}
                    >
                      <option value="">Select Customer/Supplier</option>
                      {customersSuppliers
                        .filter((cs) => cs.type === formData.order_type)
                        .map((cs) => (
                          <option key={cs.id} value={cs.id}>
                            {cs.company_name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table table-striped table-sm">
                    <thead className="table-dark">
                      <tr>
                        <th>Serial No</th>
                        <th>Project No</th>
                        <th>Date PO</th>
                        <th>Part No</th>
                        <th>Material No</th>
                        <th>Description</th>
                        <th>UOM</th>
                        <th>Quantity</th>
                        <th>Unit Price</th>
                        <th>Total Price</th>
                        <th>Lead Time</th>
                        <th>Comments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importedItems.map((item, index) => (
                        <tr key={index}>
                          <td>{item.serial_no}</td>
                          <td>{item.project_no}</td>
                          <td>{item.date_po}</td>
                          <td>{item.part_no}</td>
                          <td>{item.material_no}</td>
                          <td>{item.description}</td>
                          <td>{item.uom}</td>
                          <td>{item.quantity}</td>
                          <td>${item.unit_price}</td>
                          <td>${item.total_price}</td>
                          <td>{item.lead_time}</td>
                          <td>{item.comments}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowVerificationModal(false);
                    setImportedItems([]);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-info"
                  onClick={handleDownloadVerifiedData}
                  disabled={importedItems.length === 0}
                >
                  <i className="fas fa-file-pdf"></i> Download PDF
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleSaveImportedData}
                  disabled={
                    loading ||
                    !formData.po_number ||
                    !formData.customer_supplier_id
                  }
                >
                  {loading ? "Saving..." : "Save to Database"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {showDetailsModal && selectedOrder && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Purchase Order Details - {selectedOrder.order.po_number}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedOrder(null);
                  }}
                >×</button>
              </div>
              <div className="modal-body">
                <div className="row mb-4">
                  <div className="col-md-6">
                    <h6>Order Information</h6>
                    <p>
                      <strong>PO Number:</strong>{" "}
                      {selectedOrder.order.po_number}
                    </p>
                    <p>
                      <strong>Type:</strong>{" "}
                      {selectedOrder.order.order_type === "customer"
                        ? "Customer PO"
                        : "Supplier PO"}
                    </p>
                    <p>
                      <strong>Customer/Supplier:</strong>{" "}
                      {selectedOrder.order.customer_supplier_name}
                    </p>
                    <p>
                      <strong>Status:</strong>{" "}
                      <span
                        className={getStatusBadge(selectedOrder.order.status)}
                      >
                        {selectedOrder.order.status}
                      </span>
                    </p>
                  </div>
                  {/* <div className="col-md-6">
                    <h6>Additional Details</h6>
                    <p><strong>Total Amount:</strong> ${selectedOrder.order.total_amount}</p>
                    <p><strong>Created By:</strong> {selectedOrder.order.created_by_name}</p>
                    <p><strong>Created Date:</strong> {new Date(selectedOrder.order.created_at).toLocaleDateString()}</p>
                    {selectedOrder.order.approved_by_name && (
                      <p><strong>Approved By:</strong> {selectedOrder.order.approved_by_name}</p>
                    )}
                  </div> */}
                </div>

                <h6>Order Items</h6>
                <div className="table-responsive">
                  <table className="table table-striped table-sm">
                    <thead className="table-dark">
                      <tr>
                        <th>Serial No</th>
                        <th>Project No</th>
                        <th>Date PO</th>
                        <th>Part No</th>
                        <th>Material No</th>
                        <th>Description</th>
                        <th>UOM</th>
                        <th>Quantity</th>
                        <th>Unit Price</th>
                        <th>Total Price</th>
                        <th>Lead Time</th>
                        <th>Comments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items.map((item, index) => (
                        <tr key={index}>
                          <td>{item.serial_no}</td>
                          <td>{item.project_no}</td>
                          <td>
                            {item.date_po
                              ? new Date(item.date_po).toLocaleDateString()
                              : ""}
                          </td>
                          <td>{item.part_no}</td>
                          <td>{item.material_no}</td>
                          <td>{item.description}</td>
                          <td>{item.uom}</td>
                          <td>{item.quantity}</td>
                          <td>${item.unit_price}</td>
                          <td>${item.total_price}</td>
                          <td>{item.comments}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedOrder(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoices List Modal */}
      {showInvoicesModal && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Sales Tax Invoices</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowInvoicesModal(false);
                    setInvoicesForPO([]);
                  }}
                >×</button>
              </div>
              <div className="modal-body">
                {invoicesForPO.length === 0 ? (
                  <div className="text-muted">
                    No invoices found for this PO.
                  </div>
                ) : (
                  <div className="list-group">
                    {invoicesForPO.map((inv) => (
                      <div
                        key={inv.id}
                        className="list-group-item d-flex justify-content-between align-items-center"
                      >
                        <div>
                          <div>
                            <strong>{inv.invoice_number}</strong>
                          </div>
                          <div className="small text-muted">
                            Date:{" "}
                            {new Date(inv.invoice_date).toLocaleDateString()} |
                            Claim: {inv.claim_percentage}% | Gross: AED{" "}
                            {inv.gross_total?.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                        <div>
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => openInvoiceView(inv.id)}
                          >
                            View Invoice
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowInvoicesModal(false);
                    setInvoicesForPO([]);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice View Modal (reuses SalesTaxInvoice) */}
      {showInvoiceViewModal && viewInvoiceId && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Invoice Preview</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowInvoiceViewModal(false);
                    setViewInvoiceId(null);
                  }}
                >×</button>
              </div>
              <div className="modal-body" ref={invoiceModalBodyRef}>
                <SalesTaxInvoice invoiceId={viewInvoiceId} />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={printInvoiceOnly}
                >
                  Print
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={downloadInvoice}
                >
                  Download
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowInvoiceViewModal(false);
                    setViewInvoiceId(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Invoices List Modal */}
      {showSupplierInvoicesModal && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Purchase Tax Invoices</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowSupplierInvoicesModal(false);
                    setSupplierInvoicesForPO([]);
                  }}
                >×</button>
              </div>
              <div className="modal-body">
                {supplierInvoicesForPO.length === 0 ? (
                  <div className="text-muted">
                    No invoices found for this PO.
                  </div>
                ) : (
                  <div className="list-group">
                    {supplierInvoicesForPO.map((inv) => (
                      <div
                        key={inv.id}
                        className="list-group-item d-flex justify-content-between align-items-center"
                      >
                        <div>
                          <div>
                            <strong>{inv.invoice_number}</strong>
                          </div>
                          <div className="small text-muted">
                            Date:{" "}
                            {new Date(inv.invoice_date).toLocaleDateString()} |
                            Claim: {inv.claim_percentage}% | Gross: AED{" "}
                            {inv.gross_total?.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                        <div>
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => openSupplierInvoiceView(inv.id)}
                          >
                            View Invoice
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowSupplierInvoicesModal(false);
                    setSupplierInvoicesForPO([]);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Invoice View Modal (reuses PurchaseTaxInvoice) */}
      {showSupplierInvoiceViewModal && viewSupplierInvoiceId && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Invoice Preview</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowSupplierInvoiceViewModal(false);
                    setViewSupplierInvoiceId(null);
                  }}
                >×</button>
              </div>
              <div className="modal-body" ref={supplierInvoiceModalBodyRef}>
                <PurchaseTaxInvoice invoiceId={viewSupplierInvoiceId} />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={printSupplierInvoiceOnly}
                >
                  Print
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={downloadSupplierInvoice}
                >
                  Download
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowSupplierInvoiceViewModal(false);
                    setViewSupplierInvoiceId(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Backdrop */}
      {(showModal ||
        showImportModal ||
        showVerificationModal ||
        showDetailsModal ||
        showInvoicesModal ||
        showInvoiceViewModal ||
        showSupplierInvoicesModal ||
        showSupplierInvoiceViewModal) && (
        <div className="modal-backdrop show"></div>
      )}
    </div>
  );
};

export default PurchaseOrdersManagement;
