import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import './style.scss';

const Dashboard = () => {
  const { user, isAdmin } = useAuth();

  return (
    <div className="dashboard-container">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <div className="dashboard-header">
              <h1 className="dashboard-title">Dashboard</h1>
              <p className="dashboard-subtitle">
                Welcome back, {user?.username}! ({user?.role})
              </p>
            </div>
          </div>
        </div>
        
        <div className="row">
          <div className="col-md-6 col-lg-4 mb-4">
            <div className="card dashboard-card">
              <div className="card-body text-center">
                <div className="dashboard-icon">
                  <i className="fas fa-users"></i>
                </div>
                <h5 className="card-title">Customer/Supplier Management</h5>
                <p className="card-text">
                  Manage your customers and suppliers information
                </p>
                <Link to="/customers-suppliers" className="btn btn-primary">
                  Manage Records
                </Link>
              </div>
            </div>
          </div>
          
          {isAdmin() && (
            <div className="col-md-6 col-lg-4 mb-4">
              <div className="card dashboard-card">
                <div className="card-body text-center">
                  <div className="dashboard-icon">
                    <i className="fas fa-user-cog"></i>
                  </div>
                  <h5 className="card-title">User Management</h5>
                  <p className="card-text">
                    Add, edit, and manage system users
                  </p>
                  <Link to="/users" className="btn btn-primary">
                    Manage Users
                  </Link>
                </div>
              </div>
            </div>
          )}
          
          <div className="col-md-6 col-lg-4 mb-4">
            <div className="card dashboard-card">
              <div className="card-body text-center">
                <div className="dashboard-icon">
                  <i className="fas fa-chart-bar"></i>
                </div>
                <h5 className="card-title">Reports</h5>
                <p className="card-text">
                  View system reports and analytics
                </p>
                <button className="btn btn-secondary" disabled>
                  Coming Soon
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">Quick Stats</h5>
              </div>
              <div className="card-body">
                <div className="row text-center">
                  <div className="col-md-3 mb-3">
                    <div className="stat-item">
                      <h3 className="stat-number">-</h3>
                      <p className="stat-label">Total Customers</p>
                    </div>
                  </div>
                  <div className="col-md-3 mb-3">
                    <div className="stat-item">
                      <h3 className="stat-number">-</h3>
                      <p className="stat-label">Total Suppliers</p>
                    </div>
                  </div>
                  <div className="col-md-3 mb-3">
                    <div className="stat-item">
                      <h3 className="stat-number">-</h3>
                      <p className="stat-label">Active Users</p>
                    </div>
                  </div>
                  <div className="col-md-3 mb-3">
                    <div className="stat-item">
                      <h3 className="stat-number">-</h3>
                      <p className="stat-label">Total Records</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
