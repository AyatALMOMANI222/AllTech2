// Test the Excel date conversion function
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

// Test cases
console.log('Testing Excel date conversion:');
console.log('45941 ->', convertExcelDate(45941)); // Should be around 2025-10-11
console.log('44927 ->', convertExcelDate(44927)); // Should be around 2023-01-01
console.log('43831 ->', convertExcelDate(43831)); // Should be around 2020-01-01
console.log('36526 ->', convertExcelDate(36526)); // Should be around 2000-01-01

// Test with the specific date from the error
console.log('\nTesting the problematic date:');
console.log('45941 ->', convertExcelDate(45941));

