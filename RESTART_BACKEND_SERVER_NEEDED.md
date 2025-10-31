# Backend Server Restart Required

## ⚠️ Action Required

The backend server needs to be restarted to load the new `/api/purchase-orders/next-po-number` endpoint.

## Steps to Fix

### 1. Stop the Backend Server
If the server is running, press `Ctrl + C` in the terminal where the backend is running.

### 2. Start the Backend Server Again
```bash
cd backend
npm start
```
or
```bash
cd backend
node server.js
```

### 3. Verify the Endpoint
Once the server is running, you can test the endpoint by opening in a browser:
```
http://localhost:8000/api/purchase-orders/next-po-number
```

Expected response:
```json
{
  "po_number": "PO-2024-001"
}
```

### 4. Try Import Again
After restarting, try importing an Excel file again. The PO number should now appear in the "Verify Imported Data" modal.

## What's Been Fixed

1. ✅ Backend endpoint created: `/api/purchase-orders/next-po-number`
2. ✅ Frontend fetches PO number before opening modal
3. ✅ PO number displays in the input field
4. ✅ Save button works correctly

## Why This Happened

New routes in Express.js require a server restart to be loaded into memory. The endpoint exists in the code but wasn't active until the restart.

