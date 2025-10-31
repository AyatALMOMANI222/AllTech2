import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import './style.scss';

const Home = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleGetStarted = () => {
    if (auth?.user) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="home-page">
      {/* Navigation Bar */}
      <nav className="home-navbar">
        <div className="container">
          <div className="navbar-content">
            <div className="brand">
              <div className="brand-icon">
                <i className="fas fa-shield-alt"></i>
              </div>
              <span className="brand-name">ALLTECH DEFENCE</span>
            </div>
            <div className="nav-actions">
              <button className="btn-nav" onClick={() => navigate('/login')}>
                <i className="fas fa-sign-in-alt"></i>
                <span>Sign In</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className={`hero-section ${isVisible ? 'visible' : ''}`}>
        <div className="hero-background">
          <div className="animated-grid"></div>
          <div className="gradient-overlay"></div>
          <div className="particle particle-1"></div>
          <div className="particle particle-2"></div>
          <div className="particle particle-3"></div>
          <div className="particle particle-4"></div>
          <div className="particle particle-5"></div>
        </div>
        
        <div className="container">
          <div className="row align-items-center" style={{ minHeight: '100vh', paddingTop: '80px' }}>
            <div className="col-lg-6 hero-content">
              <div className="hero-badge">
                <div className="badge-icon">
                  <i className="fas fa-award"></i>
                </div>
                <span>Premium Enterprise Solutions</span>
              </div>
              
              <h1 className="hero-title">
                <span className="title-line-1">Empowering</span>
                <span className="title-line-2">Business Excellence</span>
                <span className="title-line-3">Through Innovation</span>
              </h1>
              
              <p className="hero-description">
                AllTech Defence delivers world-class business management solutions, 
                empowering enterprises with intelligent automation, real-time insights, 
                and seamless operational control across inventory, procurement, and financial operations.
              </p>
              
              <div className="hero-buttons">
                <button className="btn btn-primary-hero" onClick={handleGetStarted}>
                  <span>Start Your Journey</span>
                  <i className="fas fa-rocket"></i>
                </button>
                <button className="btn btn-secondary-hero" onClick={() => navigate('/login')}>
                  <span>Access Platform</span>
                  <i className="fas fa-arrow-right"></i>
                </button>
              </div>
              
              <div className="hero-features">
                <div className="feature-badge">
                  <i className="fas fa-check-circle"></i>
                  <span>ISO Certified</span>
                </div>
                <div className="feature-badge">
                  <i className="fas fa-check-circle"></i>
                  <span>Cloud-Based</span>
                </div>
                <div className="feature-badge">
                  <i className="fas fa-check-circle"></i>
                  <span>24/7 Support</span>
                </div>
              </div>
            </div>
            
            <div className="col-lg-6 hero-visual">
              <div className="visual-showcase">
                <div className="showcase-card primary-card">
                  <div className="card-header-custom">
                    <div className="header-icon">
                      <i className="fas fa-chart-line"></i>
                    </div>
                    <div className="header-text">
                      <h6>Performance Analytics</h6>
                      <span>Real-time monitoring</span>
                    </div>
                  </div>
                  <div className="card-chart">
                    <div className="chart-bar" style={{height: '60%'}}></div>
                    <div className="chart-bar" style={{height: '85%'}}></div>
                    <div className="chart-bar" style={{height: '70%'}}></div>
                    <div className="chart-bar" style={{height: '95%'}}></div>
                    <div className="chart-bar" style={{height: '75%'}}></div>
                  </div>
                </div>
                
                <div className="showcase-card secondary-card">
                  <div className="security-badge">
                    <i className="fas fa-shield-check"></i>
                    <span>Enterprise Security</span>
                  </div>
                </div>
                
                <div className="showcase-card tertiary-card">
                  <div className="notification-item">
                    <i className="fas fa-bell"></i>
                    <div className="notification-text">
                      <strong>New Order #2847</strong>
                      <span>Processing...</span>
                    </div>
                  </div>
                </div>
                
                <div className="central-hub">
                  <div className="hub-ring"></div>
                  <div className="hub-ring"></div>
                  <div className="hub-core">
                    <i className="fas fa-building"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="hero-decoration">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 0L60 10C120 20 240 40 360 46.7C480 53 600 47 720 43.3C840 40 960 40 1080 46.7C1200 53 1320 67 1380 73.3L1440 80V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0V0Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Powerful Features</h2>
            <p className="section-subtitle">
              Everything you need to manage your business efficiently
            </p>
          </div>
          
          <div className="row g-4">
            <div className="col-lg-4 col-md-6">
              <div className="feature-card">
                <div className="feature-icon">
                  <i className="fas fa-boxes"></i>
                </div>
                <h3>Inventory Management</h3>
                <p>
                  Track stock levels, manage suppliers, and automate reordering 
                  with our intelligent inventory system.
                </p>
                <div className="feature-link">
                  Learn more <i className="fas fa-arrow-right"></i>
                </div>
              </div>
            </div>
            
            <div className="col-lg-4 col-md-6">
              <div className="feature-card">
                <div className="feature-icon">
                  <i className="fas fa-file-invoice-dollar"></i>
                </div>
                <h3>Smart Invoicing</h3>
                <p>
                  Generate professional invoices, track payments, and manage 
                  tax compliance effortlessly.
                </p>
                <div className="feature-link">
                  Learn more <i className="fas fa-arrow-right"></i>
                </div>
              </div>
            </div>
            
            <div className="col-lg-4 col-md-6">
              <div className="feature-card">
                <div className="feature-icon">
                  <i className="fas fa-shopping-cart"></i>
                </div>
                <h3>Purchase Orders</h3>
                <p>
                  Streamline procurement processes, manage vendor relationships, 
                  and optimize purchasing decisions.
                </p>
                <div className="feature-link">
                  Learn more <i className="fas fa-arrow-right"></i>
                </div>
              </div>
            </div>
            
            <div className="col-lg-4 col-md-6">
              <div className="feature-card">
                <div className="feature-icon">
                  <i className="fas fa-users"></i>
                </div>
                <h3>Customer Relations</h3>
                <p>
                  Manage customer data, track interactions, and build 
                  lasting business relationships.
                </p>
                <div className="feature-link">
                  Learn more <i className="fas fa-arrow-right"></i>
                </div>
              </div>
            </div>
            
            <div className="col-lg-4 col-md-6">
              <div className="feature-card">
                <div className="feature-icon">
                  <i className="fas fa-chart-bar"></i>
                </div>
                <h3>Analytics & Reports</h3>
                <p>
                  Gain actionable insights with comprehensive analytics 
                  and customizable reporting tools.
                </p>
                <div className="feature-link">
                  Learn more <i className="fas fa-arrow-right"></i>
                </div>
              </div>
            </div>
            
            <div className="col-lg-4 col-md-6">
              <div className="feature-card">
                <div className="feature-icon">
                  <i className="fas fa-cloud"></i>
                </div>
                <h3>Cloud-Based</h3>
                <p>
                  Access your data anywhere, anytime with our secure 
                  cloud infrastructure and real-time sync.
                </p>
                <div className="feature-link">
                  Learn more <i className="fas fa-arrow-right"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="container">
          <div className="row g-4">
            <div className="col-lg-3 col-md-6">
              <div className="stat-box">
                <div className="stat-icon">
                  <i className="fas fa-building"></i>
                </div>
                <div className="stat-number">500+</div>
                <div className="stat-text">Active Businesses</div>
              </div>
            </div>
            
            <div className="col-lg-3 col-md-6">
              <div className="stat-box">
                <div className="stat-icon">
                  <i className="fas fa-file-invoice"></i>
                </div>
                <div className="stat-number">1M+</div>
                <div className="stat-text">Invoices Generated</div>
              </div>
            </div>
            
            <div className="col-lg-3 col-md-6">
              <div className="stat-box">
                <div className="stat-icon">
                  <i className="fas fa-globe"></i>
                </div>
                <div className="stat-number">50+</div>
                <div className="stat-text">Countries</div>
              </div>
            </div>
            
            <div className="col-lg-3 col-md-6">
              <div className="stat-box">
                <div className="stat-icon">
                  <i className="fas fa-award"></i>
                </div>
                <div className="stat-number">15+</div>
                <div className="stat-text">Years Experience</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-box">
            <h2 className="cta-title">Ready to Transform Your Business?</h2>
            <p className="cta-description">
              Join hundreds of businesses worldwide that trust AllTech for their 
              complete business management solution.
            </p>
            <button className="btn btn-cta" onClick={handleGetStarted}>
              <span>Start Your Journey</span>
              <i className="fas fa-rocket"></i>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="container">
          <div className="row">
            <div className="col-lg-4 col-md-6 mb-4">
              <h4 className="footer-title">AllTech Business</h4>
              <p className="footer-text">
                Leading provider of enterprise business management solutions, 
                empowering companies to achieve operational excellence.
              </p>
            </div>
            
            <div className="col-lg-2 col-md-6 mb-4">
              <h5 className="footer-heading">Product</h5>
              <ul className="footer-links">
                <li><a href="#features">Features</a></li>
                <li><a href="#pricing">Pricing</a></li>
                <li><a href="#solutions">Solutions</a></li>
              </ul>
            </div>
            
            <div className="col-lg-2 col-md-6 mb-4">
              <h5 className="footer-heading">Company</h5>
              <ul className="footer-links">
                <li><a href="#about">About Us</a></li>
                <li><a href="#careers">Careers</a></li>
                <li><a href="#contact">Contact</a></li>
              </ul>
            </div>
            
            <div className="col-lg-4 col-md-6 mb-4">
              <h5 className="footer-heading">Get In Touch</h5>
              <div className="footer-contact">
                <div className="contact-item">
                  <i className="fas fa-envelope"></i>
                  <span>Info@alltech-defence.ae</span>
                </div>
                <div className="contact-item">
                  <i className="fas fa-phone"></i>
                  <span>+971 50 621 3247</span>
                </div>
                <div className="contact-item">
                  <i className="fas fa-map-marker-alt"></i>
                  <span>Abu Dhabi, UAE</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="footer-bottom">
            <p>&copy; 2024 AllTech. All rights reserved.</p>
            <div className="social-links">
              <a href="#" aria-label="LinkedIn"><i className="fab fa-linkedin"></i></a>
              <a href="#" aria-label="Twitter"><i className="fab fa-twitter"></i></a>
              <a href="#" aria-label="Facebook"><i className="fab fa-facebook"></i></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;

