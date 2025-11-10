# AllTech Business Management System

A full-stack web application for managing customers, suppliers, and users with role-based access control.

## Features

- **Authentication System**: Login with JWT tokens
- **Role-based Access**: Admin and User roles
- **User Management**: Admin can add, edit, and delete users
- **Customer/Supplier Management**: CRUD operations for business contacts
- **Responsive Design**: Bootstrap-based UI with custom SCSS
- **Search and Filter**: Find records quickly

## Tech Stack

### Backend
- Node.js with Express
- MySQL database
- JWT authentication
- bcryptjs for password hashing
- express-validator for input validation

### Frontend
- React 18
- React Router for navigation
- Bootstrap 5 for UI components
- SCSS for custom styling
- Axios for API calls

## Prerequisites

- Node.js (v14 or higher)
- MySQL server
- npm or yarn

## Installation

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Configure your database:
   - Create a MySQL database named `alltech_business`
   - Update the `.env` file with your database credentials

4. Initialize the database:
```bash
npm run init-db
```

5. Start the development server:
```bash
npm run dev
```

The backend will run on `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The frontend will run on `http://localhost:3000`

## Default Login Credentials

- **Username**: admin
- **Password**: admin123

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - Register new user (Admin only)
- `GET /api/auth/me` - Get current user info

### Users
- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/:id` - Get user by ID (Admin only)
- `PUT /api/users/:id` - Update user (Admin only)
- `DELETE /api/users/:id` - Delete user (Admin only)
- `PUT /api/users/:id/password` - Change user password (Admin only)

### Customers/Suppliers
- `GET /api/customers-suppliers` - Get all records
- `GET /api/customers-suppliers/:id` - Get record by ID
- `POST /api/customers-suppliers` - Create new record
- `PUT /api/customers-suppliers/:id` - Update record
- `DELETE /api/customers-suppliers/:id` - Delete record

### Storage (Bunny.net)
- `POST /api/storage/upload` - Upload a file (use `multipart/form-data` with a `file` field and optional `directory`)
- `GET /api/storage/files/<path>` - Retrieve a stored file (append `?download=true` to force download)
- `DELETE /api/storage/files/<path>` - Delete a stored file

Successful uploads return the canonical storage path together with the CDN URL derived from `BUNNY_STORAGE_URL`.

## Database Schema

### Users Table
- `id` (INT, Primary Key)
- `username` (VARCHAR, Unique)
- `email` (VARCHAR, Unique)
- `password` (VARCHAR, Hashed)
- `role` (ENUM: 'admin', 'user')
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Customers/Suppliers Table
- `id` (VARCHAR, Primary Key, UUID)
- `type` (ENUM: 'customer', 'supplier')
- `company_name` (VARCHAR)
- `address` (TEXT)
- `trn_number` (VARCHAR)
- `contact_person` (VARCHAR)
- `email` (VARCHAR)
- `phone` (VARCHAR)
- `document_attachment` (VARCHAR)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

## Environment Variables

### Backend (.env)
```
PORT=8000
NODE_ENV=development
DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3307
DB_DATABASE=alltech_business
DB_USERNAME=root
DB_PASSWORD=
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
BUNNY_STORAGE_HOSTNAME=storage.bunnycdn.com
BUNNY_STORAGE_USERNAME=your-storage-zone
BUNNY_STORAGE_PASSWORD=your-storage-access-key
BUNNY_STORAGE_URL=https://your-cdn-pullzone.b-cdn.net
```

### Bunny.net Storage Integration

- `BUNNY_STORAGE_HOSTNAME`: Bunny.net storage hostname (for example, `storage.bunnycdn.com`).
- `BUNNY_STORAGE_USERNAME`: The storage zone name.
- `BUNNY_STORAGE_PASSWORD`: Storage access key (sent as the `AccessKey` header).
- `BUNNY_STORAGE_URL`: Public CDN base URL used to serve uploaded files.

All four variables are required. On Railway, add them through **Variables**—the backend will refuse Bunny operations if any are missing.

## Project Structure

```
├── backend/
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   └── customersSuppliers.js
│   ├── server.js
│   ├── initDb.js
│   ├── package.json
│   └── .env
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard/
│   │   │   ├── Layout/
│   │   │   ├── Login/
│   │   │   ├── ProtectedRoute/
│   │   │   ├── UserManagement/
│   │   │   ├── UserForm/
│   │   │   ├── CustomerSupplierManagement/
│   │   │   └── CustomerSupplierForm/
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── styles/
│   │   │   ├── _variables.scss
│   │   │   └── index.scss
│   │   ├── utils/
│   │   │   └── AuthContext.js
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
```

## Usage

1. **Login**: Use the default admin credentials to log in
2. **Dashboard**: View system overview and quick access to features
3. **User Management**: Add, edit, and manage system users (Admin only)
4. **Customer/Supplier Management**: Manage business contacts with full CRUD operations
5. **Search**: Use the search functionality to find specific records
6. **Filter**: Filter records by type (Customer/Supplier)

## Security Features

- JWT token-based authentication
- Password hashing with bcryptjs
- Input validation and sanitization
- Role-based access control
- CORS protection
- SQL injection prevention

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License.
