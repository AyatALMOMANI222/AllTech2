/**
 * Format a number with commas and up to 2 decimal places
 * @param {number|string} value - The number to format
 * @returns {string} - Formatted number string (e.g., "1,234.56")
 */
const formatNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return '0.00';
  }
  
  const numericValue = typeof value === "string" ? value.replace(/,/g, "") : value;
  const amount = Number(numericValue);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  return safeAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default formatNumber;



