import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './utils/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './components/Home';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import UserManagement from './components/UserManagement';
import CustomerSupplierManagement from './components/CustomerSupplierManagement';
import InventoryManagement from './components/InventoryManagement';
import InventoryReport from './components/InventoryReport';
import DatabaseDashboard from './components/DatabaseDashboard';
import PurchaseOrdersManagement from './components/PurchaseOrdersManagement';
import SalesTaxInvoice from './components/SalesTaxInvoice';
import PurchaseTaxInvoice from './components/PurchaseTaxInvoice';
import './styles/index.scss';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            
            {/* Protected Routes */}
            <Route path="/home" element={
              <ProtectedRoute>
                <Layout>
                  <Navigate to="/dashboard" replace />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/users" element={
              <ProtectedRoute requireAdmin={true}>
                <Layout>
                  <UserManagement />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/customers-suppliers" element={
              <ProtectedRoute>
                <Layout>
                  <CustomerSupplierManagement />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/inventory" element={
              <ProtectedRoute>
                <Layout>
                  <InventoryManagement />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/inventory-report" element={
              <ProtectedRoute>
                <Layout>
                  <InventoryReport />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/database-dashboard" element={
              <ProtectedRoute>
                <Layout>
                  <DatabaseDashboard />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/purchase-orders" element={
              <ProtectedRoute>
                <Layout>
                  <PurchaseOrdersManagement />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/sales-tax-invoice" element={
              <ProtectedRoute>
                <Layout>
                  <SalesTaxInvoice />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/purchase-tax-invoice" element={
              <ProtectedRoute>
                <Layout>
                  <PurchaseTaxInvoice />
                </Layout>
              </ProtectedRoute>
            } />
            
            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
