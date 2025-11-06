import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import './style.scss';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleLogout = () => {
    logout();
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div className="layout-container">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h4 className="sidebar-title">AllTech Business</h4>
          <button 
            className="sidebar-toggle d-lg-none"
            onClick={toggleSidebar}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <nav className="sidebar-nav">
          <ul className="nav flex-column">
            {/* <li className="nav-item">
              <Link 
                to="/dashboard" 
                className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <i className="fas fa-tachometer-alt me-2"></i>
                Dashboard
              </Link>
            </li> */}
            
            <li className="nav-item">
              <Link 
                to="/customers-suppliers" 
                className={`nav-link ${isActive('/customers-suppliers') ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <i className="fas fa-users me-2"></i>
                Customers/Suppliers
              </Link>
            </li>
            
            <li className="nav-item">
              <Link 
                to="/inventory" 
                className={`nav-link ${isActive('/inventory') ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <i className="fas fa-boxes me-2"></i>
                Inventory Management
              </Link>
            </li>
            
            <li className="nav-item">
              <Link 
                to="/inventory-report" 
                className={`nav-link ${isActive('/inventory-report') ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <i className="fas fa-chart-line me-2"></i>
                Inventory Report
              </Link>
            </li>
            
            <li className="nav-item">
              <Link 
                to="/database-dashboard" 
                className={`nav-link ${isActive('/database-dashboard') ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <i className="fas fa-database me-2"></i>
                Database Dashboard
              </Link>
            </li>
            
            <li className="nav-item">
              <Link 
                to="/purchase-orders" 
                className={`nav-link ${isActive('/purchase-orders') ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <i className="fas fa-file-invoice me-2"></i>
                Purchase Orders
              </Link>
            </li>
            
            <li className="nav-item">
              <Link 
                to="/sales-tax-invoice" 
                className={`nav-link ${isActive('/sales-tax-invoice') ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <i className="fas fa-receipt me-2"></i>
                Sales Tax Invoice
              </Link>
            </li>
            
            <li className="nav-item">
              <Link 
                to="/purchase-tax-invoice" 
                className={`nav-link ${isActive('/purchase-tax-invoice') ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <i className="fas fa-file-invoice-dollar me-2"></i>
                Purchase Tax Invoice
              </Link>
            </li>
            
            <li className="nav-item">
              <Link 
                to="/invoices" 
                className={`nav-link ${isActive('/invoices') ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <i className="fas fa-file-invoice me-2"></i>
                Invoices Management
              </Link>
            </li>
            
            {isAdmin() && (
              <li className="nav-item">
                <Link 
                  to="/users" 
                  className={`nav-link ${isActive('/users') ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <i className="fas fa-user-cog me-2"></i>
                  User Management
                </Link>
              </li>
            )}
          </ul>
        </nav>
        
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              <i className="fas fa-user"></i>
            </div>
            <div className="user-details">
              <div className="user-name">{user?.username}</div>
              <div className="user-role">{user?.role}</div>
            </div>
          </div>
          <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>
            <i className="fas fa-sign-out-alt me-1"></i>
            Logout
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="main-content">
        {/* Top Bar */}
        <div className="topbar">
          <button 
            className="sidebar-toggle d-lg-none"
            onClick={toggleSidebar}
          >
            <i className="fas fa-bars"></i>
          </button>
          
          <div className="topbar-title">
            <h5 className="mb-0">
              {location.pathname === '/dashboard' && 'Dashboard'}
              {location.pathname === '/customers-suppliers' && 'Customer/Supplier Management'}
              {location.pathname === '/inventory' && 'Inventory Management'}
              {location.pathname === '/inventory-report' && 'Inventory Report'}
              {location.pathname === '/database-dashboard' && 'Database Dashboard'}
              {location.pathname === '/purchase-orders' && 'Purchase Orders Management'}
              {location.pathname === '/sales-tax-invoice' && 'Sales Tax Invoice'}
              {location.pathname === '/purchase-tax-invoice' && 'Purchase Tax Invoice'}
              {location.pathname === '/invoices' && 'Invoices Management'}
              {location.pathname === '/users' && 'User Management'}
            </h5>
          </div>
          
          <div className="topbar-user">
            <span className="user-greeting">
              Welcome, {user?.username}
            </span>
          </div>
        </div>
        
        {/* Page Content */}
        <div className="page-content">
          {children}
        </div>
      </div>
      
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay d-lg-none"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
};

export default Layout;
