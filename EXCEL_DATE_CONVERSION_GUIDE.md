# Excel Date Conversion Guide

## Problem
When importing Excel data into MySQL, Excel stores dates as serial numbers (like 45941) internally, but MySQL expects dates in YYYY-MM-DD format. This causes the error:
```
Incorrect date value: '45941' for column 'date_po' at row 1.
```

## Solution
The inventory import system now automatically converts Excel date serial numbers to MySQL DATE format.

### How Excel Date Serial Numbers Work
- Excel's epoch starts from January 1, 1900
- Each day is represented as a serial number (1, 2, 3, etc.)
- Excel incorrectly treats 1900 as a leap year, so we need to adjust for this bug

### Conversion Examples
- Serial number `45941` = October 11, 2025
- Serial number `44927` = January 1, 2023
- Serial number `43831` = January 1, 2020
- Serial number `36526` = January 1, 2000

### Implementation Details

#### 1. Helper Function
```javascript
function convertExcelDate(excelSerial) {
  if (!excelSerial || isNaN(excelSerial) || excelSerial <= 0) {
    return null;
  }
  
  // Excel's epoch starts from 1900-01-01, but there's a leap year bug
  // Excel incorrectly treats 1900 as a leap year, so we need to adjust
  let adjustedSerial = excelSerial;
  if (excelSerial > 59) {
    adjustedSerial = excelSerial - 1; // Adjust for Excel's leap year bug
  }
  
  const excelEpoch = new Date(1900, 0, 1);
  const jsDate = new Date(excelEpoch.getTime() + (adjustedSerial - 1) * 24 * 60 * 60 * 1000);
  
  // Format as YYYY-MM-DD
  return jsDate.toISOString().split('T')[0];
}
```

#### 2. Import Processing
The import function now automatically detects and converts Excel date serial numbers:

```javascript
// Convert Excel date serial number to MySQL DATE format
let formattedDatePo = null;
if (date_po) {
  if (!isNaN(date_po) && date_po > 0) {
    // Excel date serial number conversion
    formattedDatePo = convertExcelDate(date_po);
  } else if (typeof date_po === 'string') {
    // If it's already a string, try to parse it
    const parsedDate = new Date(date_po);
    if (!isNaN(parsedDate.getTime())) {
      formattedDatePo = parsedDate.toISOString().split('T')[0];
    }
  }
}
```

### Supported Date Formats

#### 1. Excel Serial Numbers
- Automatically detected and converted
- Example: `45941` → `2025-10-11`

#### 2. String Dates
- ISO format: `2024-01-15`
- US format: `01/15/2024`
- Other standard formats

#### 3. CSV Files
- Dates should be in string format
- Example: `2024-01-15`

### Testing the Import

#### 1. Create Test Data
Create an Excel file with dates in the `date_po` column. The system will automatically convert them.

#### 2. Import Process
1. Navigate to http://localhost:3000/inventory
2. Click "Import Excel" button
3. Select your Excel file
4. The system will automatically convert Excel date serial numbers

#### 3. Verification
Check the database to verify dates are stored correctly:
```sql
SELECT serial_no, date_po FROM inventory WHERE date_po IS NOT NULL;
```

### Error Handling
- Invalid dates are logged and skipped
- Conversion errors are reported in the import response
- Empty or null dates are handled gracefully

### Debugging
The system logs date conversion for debugging:
```
Processing date_po: 45941 (type: number)
Converted Excel date 45941 to: 2025-10-11
```

### Best Practices
1. **Excel Files**: Use proper date formatting in Excel
2. **CSV Files**: Use YYYY-MM-DD format for dates
3. **Testing**: Test with sample data before importing large datasets
4. **Verification**: Always verify imported dates in the database

### Troubleshooting
- If dates are still incorrect, check the Excel file format
- Ensure the `date_po` column contains actual dates, not text
- For CSV files, use consistent date formatting
- Check server logs for conversion details

## Files Modified
- `backend/routes/inventory.js` - Added date conversion logic
- Import functionality now handles both Excel and CSV date formats
- Automatic conversion from Excel serial numbers to MySQL DATE format

