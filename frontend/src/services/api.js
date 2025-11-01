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

// Sales Tax Invoices API
export const salesTaxInvoicesAPI = {
  getAll: (params = {}) => api.get('/sales-tax-invoices', { params }),
  getById: (id) => api.get(`/sales-tax-invoices/${id}`),
  create: (data) => api.post('/sales-tax-invoices', data),
  update: (id, data) => api.put(`/sales-tax-invoices/${id}`, data),
  delete: (id) => api.delete(`/sales-tax-invoices/${id}`),
  getCustomerPONumbers: (customerId) => api.get(`/sales-tax-invoices/customer/${customerId}/po-numbers`),
  getCustomerPOItems: (poNumber) => api.get(`/sales-tax-invoices/customer-po/${poNumber}`),
  getCustomerAutoData: (customerId) => api.get(`/sales-tax-invoices/customer/${customerId}/auto-data`),
  generatePDF: (id) => api.get(`/sales-tax-invoices/${id}/pdf`),
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
  getPoItems: (poNumber) => api.get(`/purchase-tax-invoices/po/${poNumber}`),
  generatePDF: (id) => api.get(`/purchase-tax-invoices/${id}/pdf`),
  getByPONumber: (poNumber) => api.get('/purchase-tax-invoices', { params: { po_number: poNumber } }),
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

export default api;
