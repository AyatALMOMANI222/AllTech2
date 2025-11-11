const formatCurrency = (value, options = {}) => {
  const numericValue =
    typeof value === "string" ? value.replace(/,/g, "") : value;
  const amount = Number(numericValue);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;

  const formattedNumber = safeAmount.toLocaleString('en-AE', {
    minimumFractionDigits,
    maximumFractionDigits,
  });

  return `AED ${formattedNumber}`;
};

export default formatCurrency;

