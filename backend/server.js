const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

// Load environment variables
dotenv.config();

const app = express();
const PORT = 8000;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1335293',
  database: process.env.DB_NAME || 'management',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// Make database pool available to routes
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/customers-suppliers', require('./routes/customersSuppliers'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/inventory-reports', require('./routes/inventoryReports'));
app.use('/api/database-dashboard', require('./routes/databaseDashboard'));
app.use('/api/purchase-orders', require('./routes/purchaseOrders'));
app.use('/api/sales-tax-invoices', require('./routes/salesTaxInvoices'));
app.use('/api/purchase-tax-invoices', require('./routes/purchaseTaxInvoices'));
app.use('/api/fix', require('./routes/fixStatusEnum'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
