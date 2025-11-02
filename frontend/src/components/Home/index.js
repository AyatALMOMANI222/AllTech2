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
      {/* Top Navigation Bar */}
      <nav className="home-navbar">
        <div className="container">
          <div className="navbar-content">
            <div className="brand">
              <div className="brand-icon">
                <i className="fas fa-industry"></i>
              </div>
              <div className="brand-info">
                <span className="brand-name">ALLTECH</span>
                <span className="brand-tagline">Enterprise Solutions</span>
              </div>
            </div>
            <div className="nav-actions">
              <button className="btn-nav-secondary" onClick={() => navigate('/login')}>
                <i className="fas fa-user"></i>
                <span>Login</span>
              </button>
              <button className="btn-nav-primary" onClick={handleGetStarted}>
                <span>Get Started</span>
                <i className="fas fa-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className={`hero-section ${isVisible ? 'visible' : ''}`}>
        <div className="hero-background">
          <div className="grid-pattern"></div>
          <div className="mesh-gradient"></div>
          <div className="gradient-overlay"></div>
          <div className="animated-lines">
            <div className="line line-1"></div>
            <div className="line line-2"></div>
            <div className="line line-3"></div>
          </div>
          <div className="floating-shapes">
            <div className="shape shape-1"></div>
            <div className="shape shape-2"></div>
            <div className="shape shape-3"></div>
            <div className="shape shape-4"></div>
            <div className="shape shape-5"></div>
          </div>
          <div className="particle-field">
            {[...Array(20)].map((_, i) => (
              <div 
                key={i} 
                className="particle" 
                style={{ 
                  '--delay': `${i * 0.2}s`,
                  left: `${(i * 5) % 100}%`,
                  animationDuration: `${12 + (i % 3)}s`
                }}
              ></div>
            ))}
          </div>
        </div>

        <div className="container">
          <div className="hero-content-wrapper">
            <div className="hero-content">
              <div className="hero-badge">
                <i className="fas fa-certificate"></i>
                <span>Enterprise-Grade Business Management</span>
              </div>

              <h1 className="hero-title">
                <span className="title-line title-primary">Powering</span>
                <span className="title-line title-gradient">Automotive & Defense</span>
                <span className="title-line title-accent">Operations Excellence</span>
              </h1>

              <p className="hero-description">
                AllTech delivers mission-critical business management solutions for automotive parts 
                and defense industries. Streamline operations, optimize inventory, and drive growth 
                with our comprehensive, enterprise-level platform built for precision and reliability.
              </p>

              <div className="hero-cta">
                <button className="btn btn-hero-primary" onClick={handleGetStarted}>
                  <span>Start Your Journey</span>
                  <i className="fas fa-rocket"></i>
                </button>
                <button className="btn btn-hero-secondary" onClick={() => navigate('/login')}>
                  <span>Access Platform</span>
                  <i className="fas fa-lock"></i>
                </button>
              </div>

              <div className="hero-trust-indicators">
                <div className="trust-item">
                  <div className="trust-icon-wrapper">
                    <i className="fas fa-shield-alt"></i>
                  </div>
                  <span>Military-Grade Security</span>
                </div>
                <div className="trust-item">
                  <div className="trust-icon-wrapper">
                    <i className="fas fa-certificate"></i>
                  </div>
                  <span>ISO 27001 Certified</span>
                </div>
                <div className="trust-item">
                  <div className="trust-icon-wrapper">
                    <i className="fas fa-clock"></i>
                  </div>
                  <span>99.9% Uptime SLA</span>
                </div>
              </div>
            </div>

            <div className="hero-visual">
              <div className="automotive-showcase">
                <div className="showcase-image image-main">
                  <div className="image-overlay"></div>
                  <div className="image-content">
                    <div className="image-badge">
                      <i className="fas fa-car"></i>
                      <span>Automotive Excellence</span>
                    </div>
                  </div>
                  <div className="image-shine"></div>
                </div>

                <div className="showcase-image image-secondary">
                  <div className="image-overlay"></div>
                  <div className="image-content">
                    <div className="image-badge">
                      <i className="fas fa-shield-alt"></i>
                      <span>Defense Solutions</span>
                    </div>
                  </div>
                  <div className="image-shine"></div>
                </div>

                <div className="showcase-image image-tertiary">
                  <div className="image-overlay"></div>
                  <div className="image-content">
                    <div className="image-badge">
                      <i className="fas fa-cogs"></i>
                      <span>Enterprise Platform</span>
                    </div>
                  </div>
                  <div className="image-shine"></div>
                </div>

                <div className="showcase-image image-featured">
                  <div className="image-overlay"></div>
                  <div className="image-content">
                    <div className="image-badge">
                      <i className="fas fa-industry"></i>
                      <span>Industry Leading</span>
                    </div>
                  </div>
                  <div className="image-shine"></div>
                  <div className="featured-glow"></div>
                </div>

                <div className="showcase-accent">
                  <div className="accent-ring ring-1"></div>
                  <div className="accent-ring ring-2"></div>
                  <div className="accent-core">
                    <i className="fas fa-building"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="scroll-indicator">
          <div className="scroll-text">Scroll to explore</div>
          <div className="scroll-line"></div>
          <div className="scroll-arrow">
            <i className="fas fa-chevron-down"></i>
          </div>
        </div>

        <div className="hero-divider">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 0L60 12C120 24 240 48 360 56C480 64 600 56 720 52C840 48 960 48 1080 56C1200 64 1320 80 1380 88L1440 96V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0V0Z" fill="currentColor"/>
          </svg>
        </div>
      </section>

      {/* Capabilities Section */}
      <section className="capabilities-section">
        <div className="section-background-decoration">
          <div className="decoration-circle circle-1"></div>
          <div className="decoration-circle circle-2"></div>
          <div className="decoration-circle circle-3"></div>
        </div>
        <div className="container">
          <div className="section-header">
            <div className="section-badge">
              <i className="fas fa-star"></i>
              <span>Enterprise Capabilities</span>
            </div>
            <h2 className="section-title">Comprehensive Business Management</h2>
            <p className="section-subtitle">
              Industry-leading solutions designed for automotive parts and defense operations
            </p>
          </div>

          <div className="capabilities-grid">
            <div className="capability-card">
              <div className="card-background-pattern"></div>
              <div className="card-glow"></div>
              <div className="card-top-accent"></div>
              <div className="capability-icon-wrapper">
                <div className="capability-icon">
                  <div className="icon-background"></div>
                  <div className="icon-pattern"></div>
                  <i className="fas fa-boxes"></i>
                </div>
                <div className="icon-shadow"></div>
              </div>
              <h3>Inventory Management</h3>
              <p>
                Advanced inventory control with real-time tracking, automated reordering, 
                and intelligent stock optimization for automotive parts and components.
              </p>
              <div className="capability-features">
                <div className="feature-tag">
                  <div className="tag-icon">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <span>Real-time Tracking</span>
                </div>
                <div className="feature-tag">
                  <div className="tag-icon">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <span>Auto Reorder</span>
                </div>
                <div className="feature-tag">
                  <div className="tag-icon">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <span>Smart Analytics</span>
                </div>
              </div>
              <div className="card-hover-effect"></div>
              <div className="card-bottom-decoration"></div>
            </div>

            <div className="capability-card">
              <div className="card-background-pattern"></div>
              <div className="card-glow"></div>
              <div className="card-top-accent"></div>
              <div className="capability-icon-wrapper">
                <div className="capability-icon">
                  <div className="icon-background"></div>
                  <div className="icon-pattern"></div>
                  <i className="fas fa-file-invoice-dollar"></i>
                </div>
                <div className="icon-shadow"></div>
              </div>
              <h3>Invoicing & Billing</h3>
              <p>
                Professional invoicing system with tax compliance, automated billing cycles, 
                and comprehensive financial reporting for enterprise operations.
              </p>
              <div className="capability-features">
                <div className="feature-tag">
                  <div className="tag-icon">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <span>Tax Compliance</span>
                </div>
                <div className="feature-tag">
                  <div className="tag-icon">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <span>Auto Billing</span>
                </div>
                <div className="feature-tag">
                  <div className="tag-icon">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <span>Multi-Currency</span>
                </div>
              </div>
              <div className="card-hover-effect"></div>
              <div className="card-bottom-decoration"></div>
            </div>

            <div className="capability-card">
              <div className="card-background-pattern"></div>
              <div className="card-glow"></div>
              <div className="card-top-accent"></div>
              <div className="capability-icon-wrapper">
                <div className="capability-icon">
                  <div className="icon-background"></div>
                  <div className="icon-pattern"></div>
                  <i className="fas fa-shopping-cart"></i>
                </div>
                <div className="icon-shadow"></div>
              </div>
              <h3>Purchase Orders</h3>
              <p>
                Streamlined procurement workflow from order creation to delivery tracking, 
                ensuring operational efficiency across your supply chain.
              </p>
              <div className="capability-features">
                <div className="feature-tag">
                  <div className="tag-icon">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <span>PO Tracking</span>
                </div>
                <div className="feature-tag">
                  <div className="tag-icon">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <span>Delivery Status</span>
                </div>
                <div className="feature-tag">
                  <div className="tag-icon">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <span>Vendor Management</span>
                </div>
              </div>
              <div className="card-hover-effect"></div>
              <div className="card-bottom-decoration"></div>
            </div>

            <div className="capability-card">
              <div className="card-background-pattern"></div>
              <div className="card-glow"></div>
              <div className="card-top-accent"></div>
              <div className="capability-icon-wrapper">
                <div className="capability-icon">
                  <div className="icon-background"></div>
                  <div className="icon-pattern"></div>
                  <i className="fas fa-users-cog"></i>
                </div>
                <div className="icon-shadow"></div>
              </div>
              <h3>Customer & Supplier</h3>
              <p>
                Comprehensive relationship management with centralized data, 
                interaction history, and integrated communication tools.
              </p>
              <div className="capability-features">
                <div className="feature-tag">
                  <div className="tag-icon">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <span>CRM Integration</span>
                </div>
                <div className="feature-tag">
                  <div className="tag-icon">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <span>Contact History</span>
                </div>
                <div className="feature-tag">
                  <div className="tag-icon">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <span>Communication Hub</span>
                </div>
              </div>
              <div className="card-hover-effect"></div>
              <div className="card-bottom-decoration"></div>
            </div>

            <div className="capability-card">
              <div className="card-background-pattern"></div>
              <div className="card-glow"></div>
              <div className="card-top-accent"></div>
              <div className="capability-icon-wrapper">
                <div className="capability-icon">
                  <div className="icon-background"></div>
                  <div className="icon-pattern"></div>
                  <i className="fas fa-chart-pie"></i>
                </div>
                <div className="icon-shadow"></div>
              </div>
              <h3>Analytics & Reports</h3>
              <p>
                Advanced business intelligence with customizable dashboards, 
                predictive analytics, and comprehensive reporting suite.
              </p>
              <div className="capability-features">
                <div className="feature-tag">
                  <div className="tag-icon">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <span>Custom Dashboards</span>
                </div>
                <div className="feature-tag">
                  <div className="tag-icon">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <span>Predictive Analytics</span>
                </div>
                <div className="feature-tag">
                  <div className="tag-icon">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <span>Export Reports</span>
                </div>
              </div>
              <div className="card-hover-effect"></div>
              <div className="card-bottom-decoration"></div>
            </div>

            <div className="capability-card">
              <div className="card-background-pattern"></div>
              <div className="card-glow"></div>
              <div className="card-top-accent"></div>
              <div className="capability-icon-wrapper">
                <div className="capability-icon">
                  <div className="icon-background"></div>
                  <div className="icon-pattern"></div>
                  <i className="fas fa-server"></i>
                </div>
                <div className="icon-shadow"></div>
              </div>
              <h3>Cloud Infrastructure</h3>
              <p>
                Enterprise cloud platform with global data centers, automatic backups, 
                and scalable infrastructure designed for mission-critical operations.
              </p>
              <div className="capability-features">
                <div className="feature-tag">
                  <div className="tag-icon">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <span>Global CDN</span>
                </div>
                <div className="feature-tag">
                  <div className="tag-icon">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <span>Auto Backup</span>
                </div>
                <div className="feature-tag">
                  <div className="tag-icon">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <span>Scalable</span>
                </div>
              </div>
              <div className="card-hover-effect"></div>
              <div className="card-bottom-decoration"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      {/* <section className="stats-section">
        <div className="stats-background-decoration">
          <div className="stats-glow glow-1"></div>
          <div className="stats-glow glow-2"></div>
          <div className="stats-pattern"></div>
        </div>
        <div className="container">
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-icon">
                <i className="fas fa-building"></i>
              </div>
              <div className="stat-number" data-target="500">0</div>
              <div className="stat-label">Enterprise Clients</div>
              <div className="stat-suffix">+</div>
            </div>

            <div className="stat-item">
              <div className="stat-icon">
                <i className="fas fa-file-invoice"></i>
              </div>
              <div className="stat-number" data-target="1000000">0</div>
              <div className="stat-label">Invoices Processed</div>
              <div className="stat-suffix">+</div>
            </div>

            <div className="stat-item">
              <div className="stat-icon">
                <i className="fas fa-globe-americas"></i>
              </div>
              <div className="stat-number" data-target="50">0</div>
              <div className="stat-label">Countries Served</div>
              <div className="stat-suffix">+</div>
            </div>

            <div className="stat-item">
              <div className="stat-icon">
                <i className="fas fa-award"></i>
              </div>
              <div className="stat-number" data-target="15">0</div>
              <div className="stat-label">Years Excellence</div>
              <div className="stat-suffix">+</div>
            </div>
          </div>
        </div>
      </section> */}

      {/* Industries Section */}
      <section className="industries-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Built for Your Industry</h2>
            <p className="section-subtitle">
              Specialized solutions tailored for automotive and defense sector requirements
            </p>
          </div>

          <div className="industries-grid">
            <div className="industry-card">
              <div className="industry-icon">
                <i className="fas fa-car"></i>
              </div>
              <h3>Automotive Parts</h3>
              <p>
                Comprehensive inventory management for automotive components, 
                parts tracking, supplier relationships, and order fulfillment.
              </p>
              <ul className="industry-features">
                <li><i className="fas fa-check"></i> Parts cataloging</li>
                <li><i className="fas fa-check"></i> Supplier network</li>
                <li><i className="fas fa-check"></i> Order automation</li>
              </ul>
            </div>

            <div className="industry-card industry-featured">
              <div className="featured-badge">Featured</div>
              <div className="industry-icon">
                <i className="fas fa-shield-alt"></i>
              </div>
              <h3>Defense & Military</h3>
              <p>
                Mission-critical systems with enhanced security, compliance tracking, 
                and specialized workflows for defense operations.
              </p>
              <ul className="industry-features">
                <li><i className="fas fa-check"></i> Security clearance</li>
                <li><i className="fas fa-check"></i> Compliance tracking</li>
                <li><i className="fas fa-check"></i> Audit trails</li>
              </ul>
            </div>

            <div className="industry-card">
              <div className="industry-icon">
                <i className="fas fa-industry"></i>
              </div>
              <h3>Manufacturing</h3>
              <p>
                End-to-end manufacturing operations management from raw materials 
                to finished products with quality control integration.
              </p>
              <ul className="industry-features">
                <li><i className="fas fa-check"></i> Production planning</li>
                <li><i className="fas fa-check"></i> Quality control</li>
                <li><i className="fas fa-check"></i> Material tracking</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-container">
            <div className="cta-content">
              <h2 className="cta-title">Ready to Transform Your Operations?</h2>
              <p className="cta-description">
                Join leading enterprises in automotive and defense industries 
                that trust AllTech for mission-critical business management.
              </p>
              <div className="cta-buttons">
                <button className="btn btn-cta-primary" onClick={handleGetStarted}>
                  <span>Start Free Trial</span>
                  <i className="fas fa-arrow-right"></i>
                </button>
                <button className="btn btn-cta-secondary" onClick={() => navigate('/login')}>
                  <span>Schedule Demo</span>
                  <i className="fas fa-calendar"></i>
                </button>
              </div>
            </div>
            <div className="cta-visual">
              <div className="cta-graphic">
                <div className="graphic-circle circle-1"></div>
                <div className="graphic-circle circle-2"></div>
                <div className="graphic-icon">
                  <i className="fas fa-rocket"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="footer-background-decoration">
          <div className="footer-glow"></div>
          <div className="footer-pattern"></div>
        </div>
        <div className="container">
          <div className="footer-content">
            <div className="footer-main">
              <div className="footer-section footer-brand">
                <div className="footer-brand-logo">
                  <div className="brand-icon">
                    <i className="fas fa-industry"></i>
                  </div>
                  <div className="brand-text">
                    <h4 className="brand-name">ALLTECH</h4>
                    <p className="brand-tagline">Enterprise Solutions</p>
                  </div>
                </div>
                <p className="footer-description">
                  Leading provider of enterprise business management solutions for 
                  automotive parts and defense industries, delivering excellence 
                  through innovation and reliability.
                </p>
                <div className="footer-social">
                  <a href="#" aria-label="LinkedIn" className="social-link">
                    <i className="fab fa-linkedin-in"></i>
                  </a>
                  <a href="#" aria-label="Twitter" className="social-link">
                    <i className="fab fa-twitter"></i>
                  </a>
                  <a href="#" aria-label="Facebook" className="social-link">
                    <i className="fab fa-facebook-f"></i>
                  </a>
                  <a href="#" aria-label="Email" className="social-link">
                    <i className="fas fa-envelope"></i>
                  </a>
                </div>
              </div>

              <div className="footer-section footer-contact">
                <h5 className="footer-heading">
                  <i className="fas fa-headset"></i>
                  Get In Touch
                </h5>
                <div className="contact-info">
                  <div className="contact-item">
                    <div className="contact-icon-wrapper">
                      <i className="fas fa-map-marker-alt"></i>
                    </div>
                    <div className="contact-text">
                      <span className="contact-label">Location</span>
                      <span className="contact-value">Abu Dhabi, United Arab Emirates</span>
                    </div>
                  </div>
                  <div className="contact-item">
                    <div className="contact-icon-wrapper">
                      <i className="fas fa-phone"></i>
                    </div>
                    <div className="contact-text">
                      <span className="contact-label">Phone</span>
                      <a href="tel:+971506213247" className="contact-value">+971 50 621 3247</a>
                    </div>
                  </div>
                  <div className="contact-item">
                    <div className="contact-icon-wrapper">
                      <i className="fas fa-envelope"></i>
                    </div>
                    <div className="contact-text">
                      <span className="contact-label">Email</span>
                      <a href="mailto:Info@alltech-defence.ae" className="contact-value">Info@alltech-defence.ae</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="footer-bottom">
              <div className="footer-bottom-left">
                <p className="copyright">&copy; {new Date().getFullYear()} AllTech. All rights reserved.</p>
                <p className="footer-tagline">Empowering businesses with enterprise-grade solutions</p>
              </div>
              <div className="footer-bottom-right">
                <div className="footer-legal">
                  <a href="#privacy" className="legal-link">
                    <i className="fas fa-shield-alt"></i>
                    Privacy Policy
                  </a>
                  <span className="separator">•</span>
                  <a href="#terms" className="legal-link">
                    <i className="fas fa-file-contract"></i>
                    Terms of Service
                  </a>
                  <span className="separator">•</span>
                  <a href="#security" className="legal-link">
                    <i className="fas fa-lock"></i>
                    Security
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;

