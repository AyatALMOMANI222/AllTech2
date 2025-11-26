import axios from 'axios';

// In production, use relative URL (same domain as frontend)
// In development, use localhost:8000
const API_BASE_URL = process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8000/api');

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getMe: () => api.get('/auth/me'),
};

// Users API
export const usersAPI = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  create: (userData) => api.post('/auth/register', userData),
  update: (id, userData) => api.put(`/users/${id}`, userData),
  delete: (id) => api.delete(`/users/${id}`),
  changePassword: (id, password) => api.put(`/users/${id}/password`, { password }),
};

// Customers/Suppliers API
export const customersSuppliersAPI = {
  getAll: (params = {}) => api.get('/customers-suppliers', { params }),
  getById: (id) => api.get(`/customers-suppliers/${id}`),
  create: (data) => api.post('/customers-suppliers', data),
  update: (id, data) => api.put(`/customers-suppliers/${id}`, data),
  delete: (id) => api.delete(`/customers-suppliers/${id}`),
};

export const customerSupplierDocumentsAPI = {
  list: (customerSupplierId) => api.get(`/customer-supplier-documents/${customerSupplierId}`),
  upload: (customerSupplierId, files, documentType = 'Other') => {
    const formData = new FormData();
    files.forEach((file) => formData.append('documents', file));
    formData.append('documentType', documentType);
    return api.post(`/customer-supplier-documents/${customerSupplierId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  delete: (documentId) => api.delete(`/customer-supplier-documents/item/${documentId}`),
  download: (documentId) =>
    api.get(`/customer-supplier-documents/item/${documentId}/download`, {
      responseType: 'blob',
    }),
  export: (documentIds) =>
    api.post(
      `/customer-supplier-documents/export`,
      { documentIds },
      { responseType: 'blob' }
    ),
};

// Sales Tax Invoices API
export const salesTaxInvoicesAPI = {
  getAll: (params = {}) => api.get('/sales-tax-invoices', { params }),
  getById: (id) => api.get(`/sales-tax-invoices/${id}`),
  create: (data) => api.post('/sales-tax-invoices', data),
  update: (id, data) => api.put(`/sales-tax-invoices/${id}`, data),
  delete: (id) => api.delete(`/sales-tax-invoices/${id}`),
  getCustomerPONumbers: (customerId) => api.get(`/sales-tax-invoices/customer/${customerId}/po-numbers`),
  getCustomerPOItems: (poNumber, params = {}) => api.get(`/sales-tax-invoices/customer-po/${poNumber}`, { params }),
  getCustomerAutoData: (customerId) => api.get(`/sales-tax-invoices/customer/${customerId}/auto-data`),
  generatePDF: (id) => api.get(`/sales-tax-invoices/${id}/pdf`, { responseType: 'blob' }),
  getByPONumber: (poNumber) => api.get('/sales-tax-invoices', { params: { customer_po_number: poNumber } }),
};

// Purchase Tax Invoices API
export const purchaseTaxInvoicesAPI = {
  getAll: (params = {}) => api.get('/purchase-tax-invoices', { params }),
  getById: (id) => api.get(`/purchase-tax-invoices/${id}`),
  create: (data) => api.post('/purchase-tax-invoices', data),
  update: (id, data) => api.put(`/purchase-tax-invoices/${id}`, data),
  delete: (id) => api.delete(`/purchase-tax-invoices/${id}`),
  getSuppliers: () => api.get('/purchase-tax-invoices/suppliers/list'),
  getPoNumbers: (supplierId = null) => {
    const params = supplierId ? { supplier_id: supplierId } : {};
    return api.get('/purchase-tax-invoices/po/list', { params });
  },
  getPoItems: (poNumber, params = {}) => api.get(`/purchase-tax-invoices/po/${poNumber}`, { params }),
  generatePDF: (id) => api.get(`/purchase-tax-invoices/${id}/pdf`, { responseType: 'blob' }),
  getByPONumber: (poNumber) => api.get('/purchase-tax-invoices', { params: { po_number: poNumber } }),
};

const getInvoiceBasePath = (type) => {
  return type === 'purchase' ? '/purchase-tax-invoices' : '/sales-tax-invoices';
};

export const invoiceDocumentsAPI = {
  list: (type, invoiceId) => api.get(`${getInvoiceBasePath(type)}/${invoiceId}/documents`),
  upload: (type, invoiceId, files = []) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('documents', file));
    return api.post(`${getInvoiceBasePath(type)}/${invoiceId}/documents`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  download: (type, documentId) =>
    api.get(`${getInvoiceBasePath(type)}/documents/${documentId}/download`, {
      responseType: 'blob',
    }),
  delete: (type, documentId) => api.delete(`${getInvoiceBasePath(type)}/documents/${documentId}`),
};

// Inventory Reports API
export const inventoryReportsAPI = {
  getReport: (params = {}) => api.get('/inventory-reports', { params }),
  exportReport: async (params = {}) => {
    const response = await api.get('/inventory-reports/export', { 
      params,
      responseType: 'blob'
    });
    return response.data;
  },
};

// Database Dashboard API
export const databaseDashboardAPI = {
  getDashboard: (params = {}) => api.get('/database-dashboard', { params }),
  exportDashboard: async (params = {}) => {
    const response = await api.get('/database-dashboard/export', { 
      params,
      responseType: 'blob'
    });
    return response.data;
  },
};

// Warranty API
export const warrantyAPI = {
  getAll: (params = {}) => api.get('/warranty', { params }),
  getById: (id) => api.get(`/warranty/${id}`),
  create: (data) => api.post('/warranty', data),
  update: (id, data) => api.put(`/warranty/${id}`, data),
  delete: (id) => api.delete(`/warranty/${id}`),
  import: (file, warrantyType) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('warranty_type', warrantyType);
    return api.post('/warranty/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getReport: (params = {}) => api.get('/warranty/report', { params }),
};

export const purchaseOrderDocumentsAPI = {
  list: (poId) => api.get(`/purchase-orders/${poId}/documents`),
  upload: (poId, files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('documents', file));
    return api.post(`/purchase-orders/${poId}/documents`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  download: (documentId) =>
    api.get(`/purchase-orders/documents/${documentId}/download`, {
      responseType: 'blob',
    }),
  downloadAll: (poId) =>
    api.post(
      `/purchase-orders/${poId}/documents/export`,
      {},
      { responseType: 'blob' }
    ),
  delete: (documentId) => api.delete(`/purchase-orders/documents/${documentId}`),
};

export default api;
