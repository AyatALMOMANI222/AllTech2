# Inventory Management System

## Overview
A comprehensive inventory management system built with React frontend and Node.js backend, featuring CRUD operations, Excel/CSV import functionality, and Bootstrap-based responsive UI.

## Features

### ✅ Core Functionality
- **Add, Edit, Delete** inventory items
- **Filter and Search** inventory items
- **Pagination** for large datasets
- **Import from Excel/CSV** files
- **Responsive Bootstrap UI**

### ✅ Data Structure
The inventory items use the following JSON structure:
```json
{
  "serial_no": "string",
  "project_no": "string", 
  "date_po": "date",
  "part_no": "string",
  "material_no": "string",
  "description": "string",
  "uom": "string",
  "quantity": "number",
  "supplier_unit_price": "number",
  "total_price": "number",
  "sold_quantity": "number",
  "balance": "number",
  "balance_amount": "number"
}
```

## Backend Implementation

### Database Schema
```sql
CREATE TABLE inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  serial_no VARCHAR(100),
  project_no VARCHAR(100),
  date_po DATE,
  part_no VARCHAR(100),
  material_no VARCHAR(100),
  description TEXT,
  uom VARCHAR(50),
  quantity DECIMAL(10,2) DEFAULT 0,
  supplier_unit_price DECIMAL(10,2) DEFAULT 0.0,
  total_price DECIMAL(10,2) DEFAULT 0.0,
  sold_quantity DECIMAL(10,2) DEFAULT 0,
  balance DECIMAL(10,2) DEFAULT 0,
  balance_amount DECIMAL(10,2) DEFAULT 0.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### API Endpoints
- `GET /api/inventory` - Get all inventory items with pagination and search
- `GET /api/inventory/:id` - Get single inventory item
- `POST /api/inventory` - Create new inventory item
- `PUT /api/inventory/:id` - Update inventory item
- `DELETE /api/inventory/:id` - Delete inventory item
- `POST /api/inventory/import` - Import from Excel/CSV file

### Dependencies Added
- `xlsx` - For Excel file processing
- `multer` - For file upload handling

## Frontend Implementation

### Components
- **InventoryManagement** - Main component with full CRUD functionality
- **Bootstrap Integration** - Responsive design with Bootstrap 5
- **Modal Forms** - Add/Edit forms in Bootstrap modals
- **File Upload** - Excel/CSV import functionality
- **Search & Filter** - Real-time search and filtering
- **Pagination** - Bootstrap pagination component

### Features
- ✅ Responsive Bootstrap UI
- ✅ Modal-based forms for Add/Edit
- ✅ File upload for Excel/CSV import
- ✅ Search and filter functionality
- ✅ Pagination for large datasets
- ✅ Loading states and error handling
- ✅ Form validation

## File Structure

```
shosho9-main/
├── backend/
│   ├── routes/
│   │   └── inventory.js          # Inventory API routes
│   ├── uploads/                  # File upload directory
│   └── initDb.js                 # Database initialization (updated)
├── frontend/
│   └── src/
│       └── components/
│           └── InventoryManagement/
│               ├── index.js      # Main component
│               └── style.scss   # Component styles
└── sample_inventory_template.csv # Sample import file
```

## Setup Instructions

### 1. Database Setup
```bash
cd shosho9-main/backend
npm run init-db
```

### 2. Backend Server
```bash
cd shosho9-main/backend
npm start
```
Server runs on: http://localhost:8000

### 3. Frontend Application
```bash
cd shosho9-main/frontend
npm start
```
Application runs on: http://localhost:3000

## Usage

### Adding Inventory Items
1. Navigate to "Inventory Management" in the sidebar
2. Click "Add Item" button
3. Fill in the form with inventory details
4. Click "Add" to save

### Editing Items
1. Click the edit button (pencil icon) next to any item
2. Modify the details in the modal
3. Click "Update" to save changes

### Deleting Items
1. Click the delete button (trash icon) next to any item
2. Confirm deletion in the popup

### Importing from Excel/CSV
1. Click "Import Excel" button
2. Select your Excel (.xlsx, .xls) or CSV file
3. Ensure your file has the correct column headers
4. Click "Import" to process the file

### Sample Import File
Use the provided `sample_inventory_template.csv` as a template for your import files.

## Navigation
The Inventory Management system is accessible via:
- **URL**: http://localhost:3000/inventory
- **Sidebar**: "Inventory Management" link

## Technical Details

### Backend Technologies
- Node.js + Express
- MySQL database
- Multer for file uploads
- XLSX library for Excel processing
- Express-validator for input validation

### Frontend Technologies
- React 18
- Bootstrap 5
- SCSS for styling
- Font Awesome icons
- Axios for API calls

### Database
- MySQL with connection pooling
- Environment variable configuration
- Automatic balance calculations

## Error Handling
- Form validation on both frontend and backend
- File upload error handling
- Database connection error handling
- User-friendly error messages

## Security Features
- Input validation and sanitization
- File type validation for uploads
- SQL injection prevention with parameterized queries
- CORS configuration for frontend-backend communication

## Performance Features
- Database connection pooling
- Pagination for large datasets
- Efficient search and filtering
- File cleanup after import

## Future Enhancements
- Export functionality (Excel/CSV)
- Advanced filtering options
- Inventory reports
- Barcode scanning integration
- Low stock alerts
- Audit trail for changes

