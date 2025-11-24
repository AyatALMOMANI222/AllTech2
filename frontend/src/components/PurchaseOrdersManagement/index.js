import React, { useState, useEffect } from "react";
import "./style.scss";
import {
  salesTaxInvoicesAPI,
  purchaseTaxInvoicesAPI,
  purchaseOrderDocumentsAPI,
} from "../../services/api";
import formatCurrency from "../../utils/formatCurrency";
import formatNumber from "../../utils/formatNumber";
import SalesTaxInvoice from "../SalesTaxInvoice";
import PurchaseTaxInvoice from "../PurchaseTaxInvoice";

// API base URL - use environment variable or detect production
const API_BASE_URL = process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8000/api');

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
const documentFileInputRef = React.useRef(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showCreateSupplierPOModal, setShowCreateSupplierPOModal] = useState(false);
  const [selectedCustomerPO, setSelectedCustomerPO] = useState(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [customersSuppliers, setCustomersSuppliers] = useState([]);
  const [importFile, setImportFile] = useState(null);
  const [importedItems, setImportedItems] = useState([]);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [poDocuments, setPODocuments] = useState([]);
  const [documentFiles, setDocumentFiles] = useState([]);
  const [documentUploading, setDocumentUploading] = useState(false);
  const [documentDownloadAllLoading, setDocumentDownloadAllLoading] =
    useState(false);
  const [documentDeletingId, setDocumentDeletingId] = useState(null);
  const [documentDownloadingId, setDocumentDownloadingId] = useState(null);
  const [documentMessage, setDocumentMessage] = useState({ type: "", text: "" });
  const [documentLoading, setDocumentLoading] = useState(false);

  const allowedDocumentStatuses = [
    "approved",
    "partially_delivered",
    "delivered_completed",
  ];
  const canUploadDocuments =
    selectedOrder?.order &&
    allowedDocumentStatuses.includes(selectedOrder.order.status);
  const [searchTerm, setSearchTerm] = useState("");
  const [supplierPOItems, setSupplierPOItems] = useState([]);
  const [supplierPOItemsLoading, setSupplierPOItemsLoading] = useState(false);
  const [supplierPOItemsError, setSupplierPOItemsError] = useState("");

  const [formData, setFormData] = useState({
    po_number: "",
    order_type: "customer",
    customer_supplier_id: "",
    penalty_percentage: "",
  });

  // Generate a default PO number in format PO-YYYY-XXX (fallback using localStorage)
  const generatePONumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const counterKey = `poCounter-${year}`;
    try {
      const current = parseInt(localStorage.getItem(counterKey) || '0', 10) || 0;
      const next = current + 1;
      localStorage.setItem(counterKey, String(next));
      const seq = String(next % 1000).padStart(3, '0');
      return `PO-${year}-${seq}`;
    } catch (_) {
      // Fallback if localStorage is unavailable
      const seq = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
      return `PO-${year}-${seq}`;
    }
  };

  // Fetch the next PO number from the database to ensure proper sequence
  const fetchNextPONumber = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${API_BASE_URL}/purchase-orders/next-po-number`, {
        headers: headers
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.po_number;
      } else {
        console.warn('Failed to fetch next PO number from API, using fallback');
        return generatePONumber();
      }
    } catch (error) {
      console.error('Error fetching next PO number:', error);
      // Fallback to localStorage-based generation if API fails
      return generatePONumber();
    }
  };

  useEffect(() => {
    fetchPurchaseOrders();
    fetchCustomersSuppliers();
  }, [currentPage, showAll, itemsPerPage]);

  const fetchPurchaseOrders = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/purchase-orders`;
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
        `${API_BASE_URL}/purchase-orders/customers-suppliers/list`
      );
      const data = await response.json();
      setCustomersSuppliers(data);
    } catch (error) {
      console.error("Error fetching customers/suppliers:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
        ...prev,
        [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = editingOrder
        ? `${API_BASE_URL}/purchase-orders/${editingOrder.id}`
        : `${API_BASE_URL}/purchase-orders`;

      const method = editingOrder ? "PUT" : "POST";
      // For new orders, always let backend generate PO number automatically
      // This ensures proper sequence without skipping numbers
      const payload = editingOrder
        ? formData
        : { ...formData, po_number: null }; // Always let backend generate for new orders

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setShowModal(false);
        setEditingOrder(null);
        // Refresh purchase orders list
        fetchPurchaseOrders();
        // Reset formData - PO number will be generated automatically when creating new PO
        setFormData({
          po_number: "",
          order_type: "customer",
          customer_supplier_id: "",
          penalty_percentage: "",
        });
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
      penalty_percentage: order.penalty_percentage || "",
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
          `${API_BASE_URL}/purchase-orders/${id}`,
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
      setDocumentLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/purchase-orders/${order.id}`
      );
      const data = await response.json();
      setSelectedOrder(data);
      setPODocuments(data.documents || []);
      setDocumentFiles([]);
      setDocumentMessage({ type: "", text: "" });
      setDocumentDeletingId(null);
      setDocumentDownloadingId(null);
      setDocumentDownloadAllLoading(false);
      if (documentFileInputRef.current) {
        documentFileInputRef.current.value = "";
      }
      setShowDetailsModal(true);
    } catch (error) {
      console.error("Error fetching order details:", error);
      alert("Error fetching order details");
    } finally {
      setDocumentLoading(false);
    }
  };

  const resetDocumentStates = () => {
    setPODocuments([]);
    setDocumentFiles([]);
    setDocumentMessage({ type: "", text: "" });
    setDocumentDeletingId(null);
    setDocumentDownloadingId(null);
    setDocumentDownloadAllLoading(false);
    if (documentFileInputRef.current) {
      documentFileInputRef.current.value = "";
    }
  };

  const handleCloseDetailsModal = () => {
    resetDocumentStates();
    setShowDetailsModal(false);
    setSelectedOrder(null);
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

  const buildSafeDocumentUrl = (url) => {
    if (!url) return "#";
    try {
      const parsed = new URL(url);
      const encodedPath = parsed.pathname
        .split("/")
        .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
        .join("/");
      parsed.pathname = encodedPath;
      return parsed.toString();
    } catch (error) {
      return url;
    }
  };

  const refreshPurchaseOrderDocuments = async (poId) => {
    try {
      setDocumentLoading(true);
      const response = await purchaseOrderDocumentsAPI.list(poId);
      setPODocuments(response.data.records || []);
    } catch (error) {
      console.error("Error fetching purchase order documents:", error);
      setDocumentMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          "Failed to refresh purchase order documents.",
      });
    } finally {
      setDocumentLoading(false);
    }
  };

  const handleDocumentFileChange = (event) => {
    setDocumentMessage({ type: "", text: "" });
    const files = Array.from(event.target.files || []);
    setDocumentFiles(files);
  };

  const handleClearDocumentSelection = () => {
    setDocumentFiles([]);
    if (documentFileInputRef.current) {
      documentFileInputRef.current.value = "";
    }
    setDocumentMessage({ type: "", text: "" });
  };

  const triggerFileDownload = (blob, fileName) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleUploadPODocuments = async () => {
    if (!selectedOrder?.order) {
      setDocumentMessage({
        type: "error",
        text: "Purchase order details are not available.",
      });
      return;
    }

    const canUploadDocuments = allowedDocumentStatuses.includes(
      selectedOrder.order.status
    );

    if (!canUploadDocuments) {
      setDocumentMessage({
        type: "error",
        text: "Documents can only be uploaded after the PO is approved.",
      });
      return;
    }

    if (documentFiles.length === 0) {
      setDocumentMessage({
        type: "error",
        text: "Please select at least one PDF file to upload.",
      });
      return;
    }

    try {
      setDocumentUploading(true);
      setDocumentMessage({ type: "", text: "" });

      await purchaseOrderDocumentsAPI.upload(
        selectedOrder.order.id,
        documentFiles
      );

      setDocumentMessage({
        type: "success",
        text: "Documents uploaded successfully.",
      });
      handleClearDocumentSelection();
      refreshPurchaseOrderDocuments(selectedOrder.order.id);
    } catch (error) {
      console.error("Error uploading PO documents:", error);
      setDocumentMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          "Failed to upload purchase order documents.",
      });
    } finally {
      setDocumentUploading(false);
    }
  };

  const handleOpenDocument = async (document) => {
    try {
      setDocumentMessage({ type: "", text: "" });
      setDocumentDownloadingId(document.id);
      const response = await purchaseOrderDocumentsAPI.download(document.id);
      
      if (response.status === 200) {
        const blob = response.data;
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        // Clean up the URL after a delay
        setTimeout(() => window.URL.revokeObjectURL(url), 100);
      } else {
        setDocumentMessage({
          type: "error",
          text: "Failed to open the selected document.",
        });
      }
    } catch (error) {
      console.error("Error opening PO document:", error);
      setDocumentMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to open the selected document.",
      });
    } finally {
      setDocumentDownloadingId(null);
    }
  };

  const handleDownloadDocument = async (document) => {
    try {
      setDocumentMessage({ type: "", text: "" });
      setDocumentDownloadingId(document.id);
      const response = await purchaseOrderDocumentsAPI.download(document.id);
      const { data, headers } = response;
      const contentType = headers?.["content-type"] || "";

      if (contentType.includes("application/json")) {
        const text = await data.text();
        let message = "Failed to download the selected document.";
        try {
          const parsed = JSON.parse(text);
          message = parsed.message || message;
        } catch (_) {
          /* ignore parse error */
        }
        setDocumentMessage({ type: "error", text: message });
        return;
      }

      const blob = data instanceof Blob ? data : new Blob([data], { type: "application/pdf" });
      const fileName =
        document.document_name || `purchase-order-document-${document.id}.pdf`;
      triggerFileDownload(blob, fileName);
    } catch (error) {
      console.error("Error downloading PO document:", error);
      setDocumentMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          "Failed to download the selected document.",
      });
    } finally {
      setDocumentDownloadingId(null);
    }
  };

  const handleDownloadAllDocuments = async () => {
    if (!selectedOrder?.order) return;

    try {
      setDocumentDownloadAllLoading(true);
      setDocumentMessage({ type: "", text: "" });
      const response = await purchaseOrderDocumentsAPI.downloadAll(
        selectedOrder.order.id
      );
      const { data, headers } = response;
      const contentType = headers?.["content-type"] || "";

      if (contentType.includes("application/json")) {
        const text = await data.text();
        let message = "Failed to download purchase order documents.";
        try {
          const parsed = JSON.parse(text);
          message = parsed.message || message;
        } catch (_) {
          /* ignore */
        }
        setDocumentMessage({ type: "error", text: message });
        return;
      }

      const blob =
        data instanceof Blob ? data : new Blob([data], { type: "application/zip" });
      const fileName = `${
        selectedOrder.order.po_number || "purchase-order"
      }-documents.zip`;
      triggerFileDownload(blob, fileName);
    } catch (error) {
      console.error("Error exporting PO documents:", error);
      setDocumentMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          "Failed to download purchase order documents.",
      });
    } finally {
      setDocumentDownloadAllLoading(false);
    }
  };

  const handleDeleteDocument = async (document) => {
    if (
      !window.confirm(
        `Delete "${document.document_name || "document"}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      setDocumentDeletingId(document.id);
      setDocumentMessage({ type: "", text: "" });
      await purchaseOrderDocumentsAPI.delete(document.id);
      setDocumentMessage({
        type: "success",
        text: "Document deleted successfully.",
      });
      refreshPurchaseOrderDocuments(selectedOrder.order.id);
    } catch (error) {
      console.error("Error deleting PO document:", error);
      setDocumentMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          "Failed to delete the selected document.",
      });
    } finally {
      setDocumentDeletingId(null);
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

  const handleSupplierPOUnitPriceChange = (index, value) => {
    setSupplierPOItems((prevItems) => {
      const updatedItems = [...prevItems];
      if (!updatedItems[index]) {
        return prevItems;
      }

      const numericValue = parseFloat(value);
      const unitPrice = Number.isNaN(numericValue) ? 0 : numericValue;
      const quantity =
        updatedItems[index].quantity !== undefined &&
        updatedItems[index].quantity !== null
          ? parseFloat(updatedItems[index].quantity)
          : 0;

      updatedItems[index] = {
        ...updatedItems[index],
        unit_price: unitPrice,
        total_price: quantity * unitPrice,
      };

      return updatedItems;
    });
  };

  const handleCreateSupplierPO = async (customerOrder) => {
    setSelectedCustomerPO(customerOrder);
    setSelectedSupplierId("");
    setSupplierPOItems([]);
    setSupplierPOItemsError("");
    setShowCreateSupplierPOModal(true);
    setSupplierPOItemsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/purchase-orders/${customerOrder.id}`
      );

      if (!response.ok) {
        throw new Error("Failed to load customer PO details");
      }

      const data = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];

      const preparedItems = items.map((item, index) => {
        const quantity =
          item.quantity !== undefined && item.quantity !== null
            ? parseFloat(item.quantity)
            : 0;
        const unitPrice =
          item.unit_price !== undefined && item.unit_price !== null
            ? parseFloat(item.unit_price)
            : 0;

        return {
          ...item,
          serial_no: item.serial_no ?? index + 1,
          quantity,
          unit_price: unitPrice,
          total_price: quantity * unitPrice,
        };
      });

      setSupplierPOItems(preparedItems);
    } catch (error) {
      console.error("Error loading customer PO items:", error);
      setSupplierPOItemsError(
        "Unable to load items for this customer PO. Please try again."
      );
    } finally {
      setSupplierPOItemsLoading(false);
    }
  };

  const handleSubmitCreateSupplierPO = async () => {
    if (!selectedSupplierId) {
      alert("Please select a supplier");
      return;
    }

    if (!selectedCustomerPO) {
      alert("Customer PO not found");
      return;
    }

    if (supplierPOItemsLoading) {
      alert("Items are still loading. Please wait and try again.");
      return;
    }

    const itemsPayload =
      supplierPOItems.length > 0
        ? supplierPOItems.map((item, index) => {
            const quantity =
              item.quantity !== undefined && item.quantity !== null
                ? parseFloat(item.quantity)
                : 0;
            const unitPrice =
              item.unit_price !== undefined && item.unit_price !== null
                ? parseFloat(item.unit_price)
                : 0;
            const totalPrice = quantity * unitPrice;

            return {
              serial_no: item.serial_no ?? index + 1,
              project_no: item.project_no,
              date_po: item.date_po,
              part_no: item.part_no,
              material_no: item.material_no,
              description: item.description,
              uom: item.uom,
              quantity,
              unit_price: unitPrice,
              total_price: totalPrice,
              comments: item.comments,
              lead_time: item.lead_time,
              due_date: item.due_date,
              penalty_percentage: item.penalty_percentage,
              invoice_no: item.invoice_no,
              delivered_quantity: item.delivered_quantity,
              delivered_unit_price: item.delivered_unit_price,
              delivered_total_price: item.delivered_total_price,
            };
          })
        : [];

    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/purchase-orders/${selectedCustomerPO.id}/create-supplier-po`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            supplier_id: selectedSupplierId,
            items: itemsPayload,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert(
          `Supplier PO created successfully!\n\nPO Number: ${data.po_number}\nLinked to Customer PO: ${data.linked_customer_po_number}`
        );
        setShowCreateSupplierPOModal(false);
        setSelectedCustomerPO(null);
        setSelectedSupplierId("");
        setSupplierPOItems([]);
        setSupplierPOItemsError("");
        // Refresh purchase orders list
        fetchPurchaseOrders();
        // Don't update formData.po_number here - it will be generated automatically when needed
        // This prevents skipping PO numbers in the sequence
      } else {
        if (data.existing_supplier_po) {
          alert(
            `Supplier PO already exists for this customer PO!\n\nExisting Supplier PO: ${data.existing_supplier_po.po_number}`
          );
        } else {
          alert("Error: " + (data.message || "Failed to create supplier PO"));
        }
      }
    } catch (error) {
      console.error("Error creating supplier PO:", error);
      alert("Error creating supplier PO");
    } finally {
      setLoading(false);
    }
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
        `${API_BASE_URL}/purchase-orders/import`,
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (response.ok) {
        setShowImportModal(false);
        // Calculate total_price automatically for each item: Total Price = Unit Price × Quantity
        const processedItems = result.items.map((item) => ({
          ...item,
          total_price: (parseFloat(item.unit_price) || 0) * (parseFloat(item.quantity) || 0),
        }));
        setImportedItems(processedItems);
        // Leave PO number empty - backend will generate it automatically when saving
        // This ensures proper sequence without skipping numbers
        setFormData((prev) => ({
          ...prev,
          po_number: "", // Leave empty - backend will generate it
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
    if (!formData.customer_supplier_id) {
      alert("Please select a customer/supplier first");
      return;
    }

    setLoading(true);
    try {
      // Always let backend generate PO number automatically to ensure proper sequence
      // This prevents skipping numbers in the sequence
      const payload = {
        ...formData,
        po_number: null, // Always let backend generate - ignore any value from formData
        items: importedItems,
      };
      
      const response = await fetch(
        `${API_BASE_URL}/purchase-orders`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        setShowVerificationModal(false);
        setImportedItems([]);
        // Refresh purchase orders list
        fetchPurchaseOrders();
        // Reset formData - PO number will be generated automatically when importing next time
        setFormData({
          po_number: "",
          order_type: "customer",
          customer_supplier_id: "",
          penalty_percentage: "",
        });
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
      penalty_percentage: "",
    });
    setEditingOrder(null);
  };

  const handleExportToExcel = () => {
    if (importedItems.length === 0) {
      alert("No data to export");
      return;
    }

    // Define headers
    const headers = [
      "Serial No",
      "Project No",
      "Date PO",
      "Part No",
      "Material No",
      "Description",
      "UOM",
      "Quantity",
      "Unit Price",
      "Total Price",
      "Lead Time",
      "Comments"
    ];

    // Create CSV content with proper Excel formatting
    let csvContent = "\uFEFF"; // BOM for UTF-8 Excel compatibility
    csvContent += headers.map(h => `"${h}"`).join(",") + "\n";

    // Add data rows
    importedItems.forEach((item) => {
      const row = [
        `"${(item.serial_no || "").replace(/"/g, '""')}"`,
        `"${(item.project_no || "").replace(/"/g, '""')}"`,
        `"${item.date_po || ""}"`,
        `"${(item.part_no || "").replace(/"/g, '""')}"`,
        `"${(item.material_no || "").replace(/"/g, '""')}"`,
        `"${(item.description || "").replace(/"/g, '""')}"`,
        `"${(item.uom || "").replace(/"/g, '""')}"`,
        item.quantity || 0,
        parseFloat(item.unit_price || 0).toFixed(2),
        parseFloat(item.total_price || 0).toFixed(2),
        `"${(item.lead_time || "").replace(/"/g, '""')}"`,
        `"${(item.comments || "").replace(/"/g, '""')}"`
      ];
      csvContent += row.join(",") + "\n";
    });

    // Create blob with proper MIME type for Excel
    const blob = new Blob([csvContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `Imported_Data_${formData.po_number || "PO"}_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPODetailsPDF = () => {
    if (!selectedOrder || !selectedOrder.items || selectedOrder.items.length === 0) {
      alert("No data to download");
      return;
    }

    // Get the customer/supplier name
    const csName = selectedOrder.order.customer_supplier_name || "N/A";

    // Calculate totals
    const totalQuantity = selectedOrder.items.reduce(
      (sum, item) => sum + (parseFloat(item.quantity) || 0),
      0
    );
    const totalAmount = selectedOrder.items.reduce(
      (sum, item) => sum + (parseFloat(item.total_price) || 0),
      0
    );
    const formattedTotalAmount = formatCurrency(totalAmount);
    const formattedItemsHtml = selectedOrder.items
      .map((item) => {
        const unitPriceFormatted = formatCurrency(item.unit_price);
        const totalPriceFormatted = formatCurrency(item.total_price);
        const datePO = item.date_po
          ? new Date(item.date_po).toLocaleDateString()
          : "";

        return `
                <tr>
                  <td>${item.serial_no || ""}</td>
                  <td>${item.project_no || ""}</td>
                  <td>${datePO}</td>
                  <td>${item.part_no || ""}</td>
                  <td>${item.material_no || ""}</td>
                  <td>${item.description || ""}</td>
                  <td>${item.uom || ""}</td>
                  <td>${item.quantity || ""}</td>
                  <td>${unitPriceFormatted}</td>
                  <td>${totalPriceFormatted}</td>
                  <td>${item.lead_time || ""}</td>
                  <td>${item.comments || ""}</td>
                </tr>
              `;
      })
      .join("");

    // Create HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Purchase Order - ${selectedOrder.order.po_number}</title>
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
              text-align: center;
              border: 1px solid #ddd;
              font-size: 11px;
            }
            .items-table tbody tr:nth-child(even) {
              background-color: #f8f9fa;
            }
            .items-table tbody tr:hover {
              background-color: #e9ecef;
            }
            .totals-section {
              margin-top: 30px;
              display: flex;
              justify-content: flex-end;
            }
            .totals-box {
              border: 2px solid #28a745;
              padding: 20px;
              border-radius: 8px;
              background-color: #f8f9fa;
              min-width: 300px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 10px;
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
            <h2>${selectedOrder.order.po_number}</h2>
          </div>

          <div class="info-section">
            <div class="info-box">
              <div class="info-row">
                <span class="info-label">PO Number:</span>
                <span class="info-value">${selectedOrder.order.po_number}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Order Type:</span>
                <span class="info-value">${
                  selectedOrder.order.order_type === "customer"
                    ? "Customer PO (Sales)"
                    : "Supplier PO (Purchase)"
                }</span>
              </div>
              <div class="info-row">
                <span class="info-label">${
                  selectedOrder.order.order_type === "customer"
                    ? "Customer Name"
                    : "Supplier Name"
                }:</span>
                <span class="info-value" style="font-weight: 600; color: #007bff;">${csName}</span>
              </div>
            </div>
            <div class="info-box">
              <div class="info-row">
                <span class="info-label">Total Items:</span>
                <span class="info-value">${selectedOrder.items.length}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Status:</span>
                <span class="info-value" style="font-weight: 600; text-transform: uppercase;">${
                  selectedOrder.order.status
                }</span>
              </div>
              <div class="info-row">
                <span class="info-label">Generated Date:</span>
                <span class="info-value">${new Date().toLocaleDateString()}</span>
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
                <th>Lead Time</th>
                <th>Comments</th>
              </tr>
            </thead>
            <tbody>
              ${formattedItemsHtml}
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
                <span class="total-value">${formattedTotalAmount}</span>
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

  const handleExportPODetailsToExcel = () => {
    if (!selectedOrder || !selectedOrder.items || selectedOrder.items.length === 0) {
      alert("No data to export");
      return;
    }

    // Define headers
    const headers = [
      "Serial No",
      "Project No",
      "Date PO",
      "Part No",
      "Material No",
      "Description",
      "UOM",
      "Quantity",
      "Unit Price",
      "Total Price",
      "Lead Time",
      "Comments"
    ];

    // Create CSV content with proper Excel formatting
    let csvContent = "\uFEFF"; // BOM for UTF-8 Excel compatibility
    csvContent += headers.map(h => `"${h}"`).join(",") + "\n";

    // Add data rows
    selectedOrder.items.forEach((item) => {
      const row = [
        `"${(item.serial_no || "").replace(/"/g, '""')}"`,
        `"${(item.project_no || "").replace(/"/g, '""')}"`,
        `"${item.date_po ? new Date(item.date_po).toLocaleDateString() : ""}"`,
        `"${(item.part_no || "").replace(/"/g, '""')}"`,
        `"${(item.material_no || "").replace(/"/g, '""')}"`,
        `"${(item.description || "").replace(/"/g, '""')}"`,
        `"${(item.uom || "").replace(/"/g, '""')}"`,
        item.quantity || 0,
        parseFloat(item.unit_price || 0).toFixed(2),
        parseFloat(item.total_price || 0).toFixed(2),
        `"${(item.lead_time || "").replace(/"/g, '""')}"`,
        `"${(item.comments || "").replace(/"/g, '""')}"`
      ];
      csvContent += row.join(",") + "\n";
    });

    // Create blob with proper MIME type for Excel
    const blob = new Blob([csvContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `PO_Details_${selectedOrder.order.po_number}_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
    const formattedTotalAmount = formatCurrency(totalAmount);
    const formattedItemsHtml = importedItems
      .map((item) => {
        const unitPriceFormatted = formatCurrency(item.unit_price);
        const totalPriceFormatted = formatCurrency(item.total_price);

        return `
                <tr>
                  <td>${item.serial_no || ""}</td>
                  <td>${item.project_no || ""}</td>
                  <td>${item.date_po || ""}</td>
                  <td>${item.part_no || ""}</td>
                  <td>${item.material_no || ""}</td>
                  <td>${item.description || ""}</td>
                  <td>${item.uom || ""}</td>
                  <td>${item.quantity || ""}</td>
                  <td>${unitPriceFormatted}</td>
                  <td>${totalPriceFormatted}</td>
                  <td>${item.comments || ""}</td>
                </tr>
              `;
      })
      .join("");

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
              ${formattedItemsHtml}
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
                <span class="total-value">${formattedTotalAmount}</span>
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
      partially_delivered: "bg-warning",
      delivered_completed: "bg-info",
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
                      <table className="table table-striped table-hover po-table">
                        <thead className="table-dark">
                          <tr>
                            <th>PO Number</th>
                            <th>Type</th>
                            <th>Customer/Supplier</th>
                            <th>Linked Customer PO</th>
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
                                {order.linked_customer_po_number ? (
                                  <span className="badge bg-info" title="Linked Customer PO">
                                    <i className="fas fa-link me-1"></i>
                                    {order.linked_customer_po_number}
                                  </span>
                                ) : order.linked_supplier_po_number ? (
                                  <span className="badge bg-success" title="Linked Supplier PO">
                                    <i className="fas fa-link me-1"></i>
                                    {order.linked_supplier_po_number}
                                  </span>
                                ) : order.order_type === "supplier" ? (
                                  <span className="text-muted">-</span>
                                ) : (
                                  <span className="text-muted">N/A</span>
                                )}
                              </td>
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
                                  <>
                                    {!order.linked_supplier_po_number ? (
                                      <button
                                        className="btn btn-sm btn-success me-1"
                                        onClick={() => handleCreateSupplierPO(order)}
                                        title="Create Supplier PO"
                                      >
                                        <i className="fas fa-plus-circle"></i> Create Supplier PO
                                      </button>
                                    ) : (
                                      <button
                                        className="btn btn-sm btn-outline-success me-1"
                                        onClick={async () => {
                                          // Fetch and view the linked supplier PO
                                          try {
                                            const response = await fetch(
                                              `${API_BASE_URL}/purchase-orders/${order.linked_supplier_po_id}`
                                            );
                                            const data = await response.json();
                                            if (data.order) {
                                              setSelectedOrder(data);
                                              setShowDetailsModal(true);
                                            } else {
                                              alert("Linked supplier PO not found");
                                            }
                                          } catch (error) {
                                            console.error("Error fetching linked supplier PO:", error);
                                            alert("Error fetching linked supplier PO");
                                          }
                                        }}
                                        title="View Linked Supplier PO"
                                      >
                                        <i className="fas fa-link"></i> View Supplier PO
                                      </button>
                                    )}
                                  <button
                                    className="btn btn-sm btn-warning me-1"
                                    onClick={() => handleViewInvoices(order)}
                                    title="View Invoices"
                                  >
                                    View 
                                  </button>
                                  </>
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
                  <label className="form-label">PO Number</label>
                      <input
                        type="text"
                        className="form-control"
                        name="po_number"
                    value={formData.po_number || ''}
                    onChange={() => {}}
                    placeholder="Will be generated automatically (PO-YYYY-XXX)"
                    disabled
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
                  </div>

                  {/* Additional Fields */}
                    <div className="row">
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
                        Optional penalty percentage (will be used in automatic calculations when invoices are created)
                        </small>
                      </div>
                      </div>

                  {/* Info Message */}
                  <div className="alert alert-info mt-3 mb-0">
                    <i className="fas fa-info-circle me-2"></i>
                    <strong>Note:</strong> Status, Delivered Quantity, Delivered Unit Price, and Delivered Total Price 
                    are automatically calculated and updated by the system when invoices are created or updated.
                      </div>
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
                      <strong>Required columns (exact match):</strong>
                      <ul className="mb-2 mt-2" style={{ fontSize: '0.9rem' }}>
                        <li>po_number</li>
                        <li>project_no</li>
                        <li>date_po</li>
                        <li>part_no</li>
                        <li>material_no</li>
                        <li>description</li>
                        <li>uom</li>
                        <li>quantity</li>
                        <li>unit_price</li>
                        <li>lead_time</li>
                        <li>due_date</li>
                        <li>comments</li>
                      </ul>
                      <small className="text-muted">
                        <i className="fas fa-info-circle me-1"></i>
                        The Excel file should have these exact column names in the first row. 
                        Total Price will be calculated automatically as Quantity × Unit Price.
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
                    <label className="form-label">PO Number</label>
                    <input
                      type="text"
                      className="form-control"
                      name="po_number"
                      value={formData.po_number || ''}
                      onChange={() => {}}
                      placeholder="Will be generated automatically (PO-YYYY-XXX)"
                      disabled
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
                  <table className="table table-striped table-sm verify-import-table">
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
                          <td>{formatCurrency(item.unit_price)}</td>
                          <td>{formatCurrency(item.total_price)}</td>
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
                  className="btn btn-warning"
                  onClick={handleExportToExcel}
                  disabled={importedItems.length === 0}
                >
                  <i className="fas fa-file-excel"></i> Export to Excel
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleSaveImportedData}
                  disabled={
                    loading ||
                    !formData.customer_supplier_id ||
                    importedItems.length === 0
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
                  onClick={handleCloseDetailsModal}
                >
                  ×
                </button>
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
                    {selectedOrder.order.linked_customer_po_number && (
                      <p>
                        <strong>Linked Customer PO:</strong>{" "}
                        <span className="badge bg-info">
                          <i className="fas fa-link me-1"></i>
                          {selectedOrder.order.linked_customer_po_number}
                        </span>
                      </p>
                    )}
                    {selectedOrder.order.linked_supplier_po_number && (
                      <p>
                        <strong>Linked Supplier PO:</strong>{" "}
                        <span className="badge bg-success">
                          <i className="fas fa-link me-1"></i>
                          {selectedOrder.order.linked_supplier_po_number}
                        </span>
                      </p>
                    )}
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
                  <table className="table table-striped table-sm po-details-table">
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
                          <td>{formatCurrency(item.unit_price)}</td>
                          <td>{formatCurrency(item.total_price)}</td>
                          <td>{item.lead_time}</td>
                          <td>{item.comments}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="po-documents-section mt-4">
                  <h6 className="mb-3">Documents Storage</h6>
                  {documentMessage.text && (
                    <div
                      className={`alert alert-${
                        documentMessage.type === "error" ? "danger" : "success"
                      } mb-3`}
                    >
                      {documentMessage.text}
                    </div>
                  )}

                  <div className="documents-upload-card">
                    <h4>
                      <i className="fas fa-cloud-upload-alt"></i>
                      Upload Documents
                    </h4>
                    <p className="documents-upload-card__hint">
                      <i className="fas fa-info-circle"></i>
                      Upload supporting PDF documents for this purchase order.
                      Only approved or delivered POs can accept documents.
                    </p>
                    <div
                      className={`documents-upload-card__input${
                        !canUploadDocuments ? " disabled" : ""
                      }`}
                    >
                      <input
                        ref={documentFileInputRef}
                        type="file"
                        accept=".pdf"
                        multiple
                        onChange={handleDocumentFileChange}
                        disabled={!canUploadDocuments || documentUploading}
                      />
                      {documentFiles.length > 0 && (
                        <div className="selected-files-list">
                          <strong>
                            <i className="fas fa-file-pdf"></i>
                            Selected ({documentFiles.length}):
                          </strong>
                          <ul>
                            {documentFiles.map((file) => (
                              <li
                                key={`${file.name}-${file.lastModified}`}
                              >
                                {file.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    {!canUploadDocuments && (
                      <p className="documents-upload-card__notice text-warning mt-2 mb-0">
                        Documents can be uploaded once this purchase order is approved.
                      </p>
                    )}
                    <div className="documents-upload-card__actions">
                      <button
                        className="btn btn-outline-secondary"
                        type="button"
                        onClick={handleClearDocumentSelection}
                        disabled={documentUploading}
                      >
                        Clear Selection
                      </button>
                      <button
                        className="btn btn-primary"
                        type="button"
                        onClick={handleUploadPODocuments}
                        disabled={
                          documentUploading ||
                          documentFiles.length === 0 ||
                          !canUploadDocuments
                        }
                      >
                        {documentUploading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-cloud-upload-alt me-2"></i>
                            Upload PDFs
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="documents-table-card mt-4">
                    <div className="documents-table-card__header">
                      <div>
                        <h4>
                          <i className="fas fa-folder-open"></i>
                          Stored Documents{" "}
                          {poDocuments.length > 0 ? (
                            <span>({poDocuments.length})</span>
                          ) : null}
                        </h4>
                        <p className="documents-table-card__subtitle">
                          Open, download, or remove uploaded documents without leaving this page.
                        </p>
                      </div>
                      {poDocuments.length > 0 && (
                        <div className="documents-table-card__actions">
                          <button
                            className="btn btn-outline-success"
                            type="button"
                            onClick={handleDownloadAllDocuments}
                            disabled={documentDownloadAllLoading}
                          >
                            {documentDownloadAllLoading ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-2" />
                                Preparing...
                              </>
                            ) : (
                              <>
                                <i className="fas fa-file-archive me-2"></i>
                                Download All
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="documents-collection">
                      {documentLoading ? (
                        <div className="documents-collection__placeholder">
                          <div
                            className="spinner-border text-primary"
                            role="status"
                          >
                            <span className="visually-hidden">Loading...</span>
                          </div>
                          <p className="mt-2 text-muted">
                            Fetching stored documents...
                          </p>
                        </div>
                      ) : poDocuments.length === 0 ? (
                        <div className="documents-collection__placeholder">
                          <i className="far fa-folder-open mb-3"></i>
                          <p className="mb-1">No documents uploaded yet.</p>
                          <p className="text-muted mb-0">
                            Use the upload section above to attach PDF documents.
                          </p>
                        </div>
                      ) : (
                        <div className="documents-grid">
                          {poDocuments.map((document) => (
                            <div className="document-card" key={document.id}>
                              <div className="document-card__icon">
                                <i className="far fa-file-pdf"></i>
                              </div>
                              <div className="document-card__content">
                                <div className="document-card__title">
                                  <h5
                                    title={
                                      document.document_name ||
                                      "Untitled Document"
                                    }
                                  >
                                    {document.document_name ||
                                      "Untitled Document"}
                                  </h5>
                                  <span className="document-card__type">
                                    {document.document_type || "PDF"}
                                  </span>
                                </div>
                                <p className="document-card__meta">
                                  <i className="far fa-clock"></i>
                                  Uploaded{" "}
                                  {document.created_at
                                    ? new Date(
                                        document.created_at
                                      ).toLocaleString()
                                    : "N/A"}
                                </p>
                              </div>
                              <div className="document-card__actions">
                                <button
                                  className="btn btn-sm btn-outline-info"
                                  type="button"
                                  onClick={() => handleOpenDocument(document)}
                                  disabled={
                                    documentDownloadingId === document.id
                                  }
                                >
                                  {documentDownloadingId === document.id ? (
                                    <span className="spinner-border spinner-border-sm" />
                                  ) : (
                                    <i className="fas fa-external-link-alt"></i>
                                  )}
                                  <span>Open</span>
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-primary"
                                  type="button"
                                  onClick={() => handleDownloadDocument(document)}
                                  disabled={
                                    documentDownloadingId === document.id
                                  }
                                >
                                  {documentDownloadingId === document.id ? (
                                    <span className="spinner-border spinner-border-sm" />
                                  ) : (
                                    <i className="fas fa-download"></i>
                                  )}
                                  <span>Download</span>
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  type="button"
                                  onClick={() => handleDeleteDocument(document)}
                                  disabled={documentDeletingId === document.id}
                                >
                                  {documentDeletingId === document.id ? (
                                    <span className="spinner-border spinner-border-sm" />
                                  ) : (
                                    <i className="fas fa-trash-alt"></i>
                                  )}
                                  <span>Delete</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-info"
                  onClick={handleDownloadPODetailsPDF}
                  disabled={!selectedOrder || !selectedOrder.items || selectedOrder.items.length === 0}
                >
                  <i className="fas fa-file-pdf"></i> Download PDF
                </button>
                <button
                  type="button"
                  className="btn btn-warning"
                  onClick={handleExportPODetailsToExcel}
                  disabled={!selectedOrder || !selectedOrder.items || selectedOrder.items.length === 0}
                >
                  <i className="fas fa-file-excel"></i> Export to Excel
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCloseDetailsModal}
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

      {/* Create Supplier PO Modal */}
      {showCreateSupplierPOModal && selectedCustomerPO && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Create Supplier PO from Customer PO
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowCreateSupplierPOModal(false);
                    setSelectedCustomerPO(null);
                    setSelectedSupplierId("");
                    setSupplierPOItems([]);
                    setSupplierPOItemsError("");
                    setSupplierPOItemsLoading(false);
                  }}
                  disabled={loading}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">
                    <strong>Customer PO:</strong>
                  </label>
                  <p className="form-control-plaintext">
                    {selectedCustomerPO.po_number} - {selectedCustomerPO.customer_supplier_name}
                  </p>
                </div>
                <div className="mb-3">
                  <label htmlFor="supplierPONumber" className="form-label">
                    <strong>Supplier PO Number:</strong>
                  </label>
                  <input
                    type="text"
                    id="supplierPONumber"
                    className="form-control"
                    value={selectedCustomerPO.po_number}
                    readOnly
                    disabled
                    style={{ backgroundColor: '#e9ecef', cursor: 'not-allowed' }}
                  />
                  <small className="form-text text-muted">
                    Supplier PO Number will match the Customer PO Number
                  </small>
                </div>
                <div className="mb-3">
                  <label htmlFor="supplierSelect" className="form-label">
                    Select Supplier <span className="text-danger">*</span>
                  </label>
                  <select
                    id="supplierSelect"
                    className="form-select"
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    disabled={loading}
                  >
                    <option value="">-- Select Supplier --</option>
                    {customersSuppliers
                      .filter((cs) => cs.type === "supplier")
                      .map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.company_name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="alert alert-info">
                  <i className="fas fa-info-circle me-2"></i>
                  This will create a new supplier PO linked to the customer PO above.
                  All items from the customer PO will be copied to the supplier PO.
                </div>
                {supplierPOItemsError && (
                  <div className="alert alert-danger mt-3" role="alert">
                    {supplierPOItemsError}
                  </div>
                )}
                {supplierPOItemsLoading ? (
                  <div className="d-flex justify-content-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : (
                  <div className="table-responsive mt-3">
                    <table className="table table-sm table-bordered">
                      <thead>
                        <tr>
                          <th style={{ width: "10%" }}>#</th>
                          <th style={{ width: "20%" }}>Part No.</th>
                          <th style={{ width: "30%" }}>Description</th>
                          <th style={{ width: "20%" }}>Quantity</th>
                          <th style={{ width: "20%" }}>Supplier Unit Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supplierPOItems.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="text-center text-muted">
                              No items available for this customer PO.
                            </td>
                          </tr>
                        ) : (
                          supplierPOItems.map((item, index) => (
                            <tr key={item.id || index}>
                              <td>{item.serial_no ?? index + 1}</td>
                              <td>{item.part_no || "-"}</td>
                              <td>{item.description || "-"}</td>
                              <td>{item.quantity ?? 0}</td>
                              <td>
                                <input
                                  type="number"
                                  className="form-control"
                                  min="0"
                                  step="0.01"
                                  value={
                                    item.unit_price !== undefined &&
                                    item.unit_price !== null
                                      ? item.unit_price
                                      : 0
                                  }
                                  onChange={(e) =>
                                    handleSupplierPOUnitPriceChange(
                                      index,
                                      e.target.value
                                    )
                                  }
                                  disabled={loading}
                                />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowCreateSupplierPOModal(false);
                    setSelectedCustomerPO(null);
                    setSelectedSupplierId("");
                    setSupplierPOItems([]);
                    setSupplierPOItemsError("");
                    setSupplierPOItemsLoading(false);
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleSubmitCreateSupplierPO}
                  disabled={loading || !selectedSupplierId}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Creating...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-plus-circle me-2"></i>
                      Create Supplier PO
                    </>
                  )}
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
        showSupplierInvoiceViewModal ||
        showCreateSupplierPOModal) && (
        <div className="modal-backdrop show"></div>
      )}
    </div>
  );
};

export default PurchaseOrdersManagement;
