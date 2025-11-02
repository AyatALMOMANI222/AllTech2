import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import './style.scss';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/customers-suppliers');
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(formData);
    
    if (result.success) {
      navigate('/customers-suppliers');
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="login-container">
      {/* Decorative background elements */}
      <div className="bg-decoration">
        <div className="bg-circle bg-circle-1"></div>
        <div className="bg-circle bg-circle-2"></div>
        <div className="bg-circle bg-circle-3"></div>
      </div>

      <div className="login-wrapper">
        {/* Left side - Branding */}
        <div className="login-branding">
          <div className="brand-content">
            <div className="brand-icon">
              <i className="fas fa-chart-line"></i>
            </div>
            <h1 className="brand-title">AllTech</h1>
            <p className="brand-subtitle">Business Management System</p>
            <div className="brand-description">
              <p>Streamline your operations with our comprehensive business management platform.</p>
            </div>
            <div className="brand-features">
              <div className="feature-item">
                <i className="fas fa-check-circle"></i>
                <span>Enterprise-grade security</span>
              </div>
              <div className="feature-item">
                <i className="fas fa-check-circle"></i>
                <span>Real-time analytics</span>
              </div>
              <div className="feature-item">
                <i className="fas fa-check-circle"></i>
                <span>24/7 Support</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Login Form */}
        <div className="login-form-section">
          <div className="login-card">
            <div className="login-header">
              <h2>Welcome Back</h2>
              <p>Sign in to continue to your account</p>
            </div>

            {error && (
              <div className="alert alert-error" role="alert">
                <i className="fas fa-exclamation-circle"></i>
                <span>{error}</span>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="username" className="form-label">
                  <i className="fas fa-user"></i>
                  <span>Username or Email</span>
                </label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    className="form-input"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="Enter your username or email"
                    required
                    disabled={loading}
                  />
                  <div className="input-focus-line"></div>
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  <i className="fas fa-lock"></i>
                  <span>Password</span>
                </label>
                <div className="input-wrapper">
                  <input
                    type="password"
                    className="form-input"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    required
                    disabled={loading}
                  />
                  <div className="input-focus-line"></div>
                </div>
              </div>
              
              <button
                type="submit"
                className="btn btn-login"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <i className="fas fa-arrow-right"></i>
                  </>
                )}
              </button>
            </form>

            <div className="login-footer">
              <div className="help-text">
                <i className="fas fa-info-circle"></i>
                <span>Default credentials: <strong>admin</strong> / <strong>admin123</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
